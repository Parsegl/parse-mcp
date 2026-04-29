import { parseFetch } from "./api_client";
import { jsonText } from "./markdown";
import type { RequestContext } from "./types";

export const RESOURCES = [
  {
    uri: "parse://showcase-brands",
    name: "Showcase brands",
    description: "Public Parse showcase brands ranked by global visibility.",
    mimeType: "application/json",
  },
  {
    uri: "parse://niches",
    name: "Public niches",
    description: "All active public industry niches Parse tracks.",
    mimeType: "application/json",
  },
  {
    uri: "parse://glossary",
    name: "Parse glossary",
    description: "Definitions for Parse MCP metrics and terms.",
    mimeType: "application/json",
  },
] as const;

const GLOSSARY = {
  parseScore: "Composite 0-100 score summarizing AI visibility.",
  strength: "How strongly AI systems associate a brand with relevant prompts.",
  reach: "Breadth of AI visibility across prompts, sources, and niches.",
  authority: "Citation and source authority signal in Parse public data.",
};

export async function readResource(context: RequestContext, uri: string) {
  if (uri === "parse://showcase-brands") {
    const data = await parseFetch(context.env, "/api/public/showcase-brands");
    return resourceResponse(uri, data);
  }

  if (uri === "parse://niches") {
    const data = await parseFetch(context.env, "/api/public/niches");
    return resourceResponse(uri, data);
  }

  if (uri === "parse://glossary") {
    return resourceResponse(uri, GLOSSARY);
  }

  throw new Error(`Unknown resource: ${uri}`);
}

function resourceResponse(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: jsonText(data),
      },
    ],
  };
}
