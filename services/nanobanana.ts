/**
 * Service to interact with Google Gemini API for rendering
 */

interface RenderResponse {
    imageUrl: string;
    status: 'success' | 'error';
    error?: string;
}

export type GeminiModel = 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image';

export async function generateRender(
    imageBlob: Blob,
    prompt: string,
    apiKey: string,
    model: GeminiModel = 'gemini-3-pro-image-preview'
): Promise<RenderResponse> {

    // Choose model based on input
    const MODEL_NAME = model;
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    try {
        // Convert blob to base64
        const base64Image = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                // Extract the base64 part (remove "data:image/png;base64," prefix)
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(imageBlob);
        });

        const payload = {
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt || "High quality render of an urban scene, architectural visualization, photorealistic, cinematic lighting, respect camera view and perspective" },
                        {
                            inlineData: {
                                mimeType: "image/png",
                                data: base64Image
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                responseModalities: ["IMAGE"],
                imageConfig: {
                    imageSize: "1K"
                }
            }
        };

        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.error?.message || `API Error: ${response.status}`);
            } catch (e) {
                throw new Error(`API Error: ${response.status} - ${errorText.slice(0, 100)}`);
            }
        }

        const data = await response.json();

        // Extract image from Gemini response
        // Structure: candidates[0].content.parts[0].inlineData.data
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (part?.inlineData?.data) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            const imageData = part.inlineData.data;
            return {
                status: 'success',
                imageUrl: `data:${mimeType};base64,${imageData}`
            };
        } else {
            throw new Error("No image data found in response");
        }

    } catch (error) {
        console.error("Rendering failed:", error);
        return {
            status: 'error',
            imageUrl: '',
            error: error instanceof Error ? error.message : 'Unknown rendering error'
        };
    }
}
