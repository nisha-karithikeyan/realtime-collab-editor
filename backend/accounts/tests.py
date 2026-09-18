from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.urls import reverse
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class RegisterTests(APITestCase):
    def test_register_creates_user(self):
        response = self.client.post(
            reverse("auth-register"),
            {"email": "new@example.com", "password": "S3curePass!23", "name": "New User"},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(email="new@example.com").exists())
        self.assertNotIn("password", response.data)

    def test_register_rejects_duplicate_email(self):
        User.objects.create_user(email="dupe@example.com", password="S3curePass!23")
        response = self.client.post(
            reverse("auth-register"), {"email": "dupe@example.com", "password": "S3curePass!23"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_rejects_weak_password(self):
        response = self.client.post(
            reverse("auth-register"), {"email": "weak@example.com", "password": "123"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_normalizes_email_case(self):
        User.objects.create_user(email="case@example.com", password="S3curePass!23")
        response = self.client.post(
            reverse("auth-register"), {"email": "Case@Example.com", "password": "S3curePass!23"}
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginAndMeTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="login@example.com", password="S3curePass!23")

    def test_login_returns_tokens(self):
        response = self.client.post(
            reverse("auth-login"), {"email": "login@example.com", "password": "S3curePass!23"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_rejects_wrong_password(self):
        response = self.client.post(
            reverse("auth-login"), {"email": "login@example.com", "password": "wrong"}
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_requires_auth(self):
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_current_user(self):
        login = self.client.post(
            reverse("auth-login"), {"email": "login@example.com", "password": "S3curePass!23"}
        )
        access = login.data["access"]
        response = self.client.get(
            reverse("auth-me"), HTTP_AUTHORIZATION=f"Bearer {access}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], "login@example.com")


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="reset@example.com", password="OldPass!23")

    def test_reset_request_does_not_leak_unknown_email(self):
        response = self.client.post(
            reverse("auth-password-reset"), {"email": "nobody@example.com"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

    def test_reset_request_sends_email_for_known_user(self):
        response = self.client.post(
            reverse("auth-password-reset"), {"email": "reset@example.com"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)

    def test_reset_confirm_changes_password(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        token = default_token_generator.make_token(self.user)
        response = self.client.post(
            reverse("auth-password-reset-confirm"),
            {"uid": uid, "token": token, "new_password": "BrandNewPass!45"},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("BrandNewPass!45"))

    def test_reset_confirm_rejects_bad_token(self):
        uid = urlsafe_base64_encode(force_bytes(self.user.pk))
        response = self.client.post(
            reverse("auth-password-reset-confirm"),
            {"uid": uid, "token": "bogus-token", "new_password": "BrandNewPass!45"},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
