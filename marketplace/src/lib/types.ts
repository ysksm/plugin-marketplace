export interface Plugin {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription: string;
  version: string;
  author: Author;
  category: Category;
  tags: string[];
  installCommand: string;
  githubUrl?: string;
  npmPackage?: string;
  icon: string;
  screenshots: string[];
  mcpConfig?: MCPConfig;
  stats: {
    downloads: number;
    stars: number;
    lastUpdated: string;
  };
  featured: boolean;
  verified: boolean;
}

export interface Author {
  name: string;
  url?: string;
  avatar?: string;
}

export type Category =
  | 'developer-tools'
  | 'productivity'
  | 'ai'
  | 'data'
  | 'testing'
  | 'monitoring';

export interface MCPConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}
