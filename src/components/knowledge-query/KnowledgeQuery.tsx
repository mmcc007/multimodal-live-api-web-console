// src/components/knowledge-query/KnowledgeQuery.tsx
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useState, memo } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";
import "./knowledge-query.scss";

// Define the query tool declaration
export const declaration: FunctionDeclaration = {
  name: "query_knowledge_base",
  description: "Query the knowledge base for information.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query_type: {
        type: SchemaType.STRING,
        description: "Type of query to perform (text, comparative, or multimodal)",
        enum: ["text", "comparative", "multimodal"]
      },
      query: {
        type: SchemaType.STRING,
        description: "The query text"
      }
    },
    required: ["query_type", "query"]
  }
};

interface Citation {
  cosine_score: number;
  file_name: string;
  page_num: number;
  chunk_text?: string;
  text?: string;
  chunk_number?: number;
}

interface ImageCitation extends Citation {
  img_path: string;
  image_description?: string;
}

interface QueryResponse {
  response: string;
  text_citations: { [key: string]: Citation };
  image_citations: { [key: string]: ImageCitation };
}

function KnowledgeQueryComponent() {
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { client, setConfig } = useLiveAPIContext();
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      systemInstruction: {
        parts: [
          {
            text: 'You are a helpful assistant with access to a knowledge base. When users ask questions, use the query_knowledge_base function to search for relevant information. For text queries use "text" type, for image related queries use "multimodal" type, and for comparing things use "comparative" type.',
          },
        ],
      },
      tools: [
        { googleSearch: {} },
        { functionDeclarations: [declaration] },
      ],
    });
  }, [setConfig]);

  useEffect(() => {
    const onToolCall = async (toolCall: ToolCall) => {
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name
      );
      
      if (fc) {
        try {
          const { query_type, query } = fc.args as {
            query_type: string;
            query: string;
          };

          const response = await fetch(`${apiBaseUrl}/api/v1/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: query_type,
              query: query
            })
          });

          if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
          }

          const data = await response.json();
          
          if (data.status === 'success') {
            setQueryResult(data.data);
            setError(null);
            client.sendToolResponse({
              functionResponses: toolCall.functionCalls.map((fc) => ({
                response: { success: true, data: data.data },
                id: fc.id,
              })),
            });
          } else {
            throw new Error(data.message || 'Query failed');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Query failed';
          setError(errorMessage);
          setQueryResult(null);
          client.sendToolResponse({
            functionResponses: toolCall.functionCalls.map((fc) => ({
              response: { success: false, error: errorMessage },
              id: fc.id,
            })),
          });
        }
      }
    };

    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client, apiBaseUrl]);

  if (error) {
    return (
      <div className="knowledge-query-error">
        Error: {error}
      </div>
    );
  }

  if (!queryResult) {
    return null;
  }

  return (
    <div className="knowledge-query-result">
      <div className="response-section">
        <h3>Response</h3>
        <p>{queryResult.response}</p>
      </div>

      {Object.keys(queryResult.text_citations).length > 0 && (
        <div className="citations-section">
          <h3>Text Citations</h3>
          {Object.entries(queryResult.text_citations).map(([key, citation]) => (
            <div key={`text-${key}`} className="citation-card">
              <div className="citation-header">
                <span className="citation-number">Citation {parseInt(key) + 1}</span>
                <span className="citation-score">Score: {citation.cosine_score.toFixed(3)}</span>
              </div>
              <div className="citation-body">
                <div className="citation-meta">
                  <span>File: {citation.file_name}</span>
                  <span>Page: {citation.page_num}</span>
                  {citation.chunk_number !== undefined && (
                    <span>Chunk: {citation.chunk_number}</span>
                  )}
                </div>
                <div className="citation-text">
                  {citation.chunk_text || citation.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {Object.keys(queryResult.image_citations).length > 0 && (
        <div className="citations-section">
          <h3>Image Citations</h3>
          {Object.entries(queryResult.image_citations).map(([key, citation]) => (
            <div key={`image-${key}`} className="citation-card">
              <div className="citation-header">
                <span className="citation-number">Citation {parseInt(key) + 1}</span>
                <span className="citation-score">Score: {citation.cosine_score.toFixed(3)}</span>
              </div>
              <div className="citation-body">
                <div className="citation-meta">
                  <span>File: {citation.file_name}</span>
                  <span>Page: {citation.page_num}</span>
                </div>
                <div className="citation-image">
                  <img src={citation.img_path} alt={citation.image_description || 'Citation image'} />
                  {citation.image_description && (
                    <div className="image-description">{citation.image_description}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const KnowledgeQuery = memo(KnowledgeQueryComponent);
