import type {
  CompleteParkResponse,
  CreateParkRequest,
  CreateParkResponse,
  ParkChunkReceipt,
  ParkStatusResponse,
} from '@beam/shared';

export class MaidClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string, private readonly signal?: AbortSignal) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async createPark(
    request: CreateParkRequest,
    accessKey: string,
  ): Promise<CreateParkResponse> {
    return this.json<CreateParkResponse>('/v1/parks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Maid-Key': accessKey,
      },
      body: JSON.stringify(request),
    });
  }

  async status(parkId: string, token: string): Promise<ParkStatusResponse> {
    return this.json<ParkStatusResponse>(`/v1/parks/${encodeURIComponent(parkId)}`, {
      headers: this.authorization(token),
    });
  }

  async uploadChunk(
    parkId: string,
    token: string,
    chunkIndex: number,
    ciphertext: Uint8Array,
  ): Promise<ParkChunkReceipt> {
    return this.json<ParkChunkReceipt>(
      `/v1/parks/${encodeURIComponent(parkId)}/chunks/${chunkIndex}`,
      {
        method: 'PUT',
        headers: {
          ...this.authorization(token),
          'Content-Type': 'application/octet-stream',
        },
        body: ciphertext.buffer.slice(
          ciphertext.byteOffset,
          ciphertext.byteOffset + ciphertext.byteLength,
        ) as ArrayBuffer,
      },
    );
  }

  async complete(parkId: string, token: string): Promise<CompleteParkResponse> {
    return this.json<CompleteParkResponse>(
      `/v1/parks/${encodeURIComponent(parkId)}/complete`,
      {
        method: 'POST',
        headers: this.authorization(token),
      },
    );
  }

  async downloadChunk(parkId: string, token: string, chunkIndex: number): Promise<Uint8Array> {
    const response = await this.request(
      `/v1/parks/${encodeURIComponent(parkId)}/chunks/${chunkIndex}`,
      { headers: this.authorization(token) },
    );
    return new Uint8Array(await response.arrayBuffer());
  }

  async remove(parkId: string, token: string): Promise<void> {
    await this.request(`/v1/parks/${encodeURIComponent(parkId)}`, {
      method: 'DELETE',
      headers: this.authorization(token),
    });
  }

  private authorization(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  private async json<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.request(path, init);
    return response.json() as Promise<T>;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          signal: this.signal,
        });
        if (response.ok) return response;
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        const error = new Error(body?.error ?? `Maid request failed (${response.status})`);
        if (response.status < 500 || attempt === 3) throw error;
        lastError = error;
      } catch (error) {
        if (this.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        lastError = error;
        if (attempt === 3) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
    throw lastError instanceof Error ? lastError : new Error('Maid request failed');
  }
}
