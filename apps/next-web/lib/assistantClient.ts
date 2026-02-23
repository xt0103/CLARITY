import { apiFetch } from "@/lib/apiClient";

export type ChatRequest = {
  message: string;
  conversationId?: string | null;
  context?: {
    activeJobId?: string | null;
    searchState?: {
      queryText?: string;
      filters?: Record<string, any>;
    };
  } | null;
};

export type UIAction = 
  | { type: "SET_SEARCH_RESULTS"; payload: { jobs: any[]; total: number } }
  | { type: "SET_SEARCH_QUERY"; payload: { queryText: string; filters: Record<string, any> } }
  | { type: "HIGHLIGHT_JOB"; payload: { jobId: string } }
  | { type: "SHOW_TOAST"; payload: { message: string; level: "success" | "error" | "info" } };

export type ChatResponse = {
  conversationId: string;
  assistantText: string;
  uiActions: UIAction[];
  debug?: {
    toolCalls?: Array<{
      name: string;
      arguments: Record<string, any>;
      result: any;
    }>;
  } | null;
};

export const assistantClient = {
  chat: (body: ChatRequest) =>
    apiFetch<ChatResponse>("/api/assistant/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
