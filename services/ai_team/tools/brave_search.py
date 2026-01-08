import os
from typing import Any

import httpx


async def search_web(query: str, site_filter: str | None = None) -> list[dict[str, Any]]:
    """
    Performs a web search using Brave Search API.

    Args:
        query: The search query string.
        site_filter: Optional domain to restrict search (e.g., 'reddit.com').

    Returns:
        List of search results with title, description, and url.
    """
    api_key = os.getenv("BRAVE_API_KEY")
    if not api_key:
        return [{"error": "BRAVE_API_KEY not found in environment variables."}]

    final_query = f"site:{site_filter} {query}" if site_filter else query

    headers = {"X-Subscription-Token": api_key, "Accept": "application/json"}
    url = "https://api.search.brave.com/res/v1/web/search"
    params = {"q": final_query, "count": 5}

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()

            results = []
            if "web" in data and "results" in data["web"]:
                for item in data["web"]["results"]:
                    results.append({
                        "title": item.get("title"),
                        "description": item.get("description"),
                        "url": item.get("url")
                    })
            return results
        except Exception as e:
            return [{"error": f"Search failed: {str(e)}"}]
