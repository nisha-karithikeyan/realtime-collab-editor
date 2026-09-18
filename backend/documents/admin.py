from django.contrib import admin

from .models import Comment, Document, DocumentSnapshot, DocumentState, Folder, Link

admin.site.register(Folder)
admin.site.register(Document)
admin.site.register(DocumentState)
admin.site.register(DocumentSnapshot)
admin.site.register(Link)
admin.site.register(Comment)
