import type { APIRequestContext } from "@playwright/test";

export async function resetTestData(request: APIRequestContext) {
  const response = await request.post("http://127.0.0.1:4000/api/test/reset");
  if (!response.ok()) {
    throw new Error(
      `Failed to reset test data. status=${response.status()} body=${await response.text()}`,
    );
  }
}
