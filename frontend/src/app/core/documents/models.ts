export interface Folder {
  id: string;
  name: string;
  parent: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  folder: string | null;
  parent_page: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DocumentTreeNode {
  id: string;
  title: string;
  parent_page: string | null;
  folder: string | null;
}

export interface Backlink {
  id: string;
  title: string;
}

export interface TagGroup {
  tag: string;
  documents: { id: string; title: string }[];
}

export interface Comment {
  id: number;
  document: string;
  block_id: string;
  author_id: string;
  author_name: string;
  body: string;
  mentioned_user_ids: string[];
  parent_comment: number | null;
  resolved: boolean;
  created_at: string;
}

export interface GraphNode {
  id: string;
  title: string;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
