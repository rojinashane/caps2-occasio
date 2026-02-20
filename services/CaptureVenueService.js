import axios from 'axios';

// IMPORTANT: Double-check this key at https://dashboard.lumaai.com/
const LUMA_API_KEY = 'luma-3b662f02-f100-4ee8-bae5-eeb21d46377c-786a9ef2-658b-43ee-9e6d-36673abd1b1d';
const BASE_URL = 'https://webapp.engineering.lumaai.com/api/v2/capture';

export const CaptureVenueService = {
    /**
     * 1. Create a Capture placeholder
     */
    createCapture: async (title = "New Venue Scan") => {
        try {
            const response = await fetch(BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${LUMA_API_KEY}`, // Changed to Bearer
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title }),
            });

            const data = await response.json();

            if (!response.ok) {
                // This will log the EXACT reason Luma is rejecting you (e.g., "Invalid Key")
                console.error("Luma Server Rejected Request:", data);
                throw new Error(data.message || `Status: ${response.status}`);
            }

            return data; // Should contain { slug, upload_url }
        } catch (error) {
            console.error("Capture Creation Failed:", error.message);
            throw error;
        }
    },

    /**
     * 2. Upload the video file
     */
    uploadVideo: async (uploadUrl, fileUri) => {
        try {
            const fileResponse = await fetch(fileUri);
            const blob = await fileResponse.blob();

            // Note: Upload URLs from Luma are usually pre-signed S3 links
            // They do NOT require the Authorization header
            return await axios.put(uploadUrl, blob, {
                headers: { 'Content-Type': 'video/mp4' },
            });
        } catch (error) {
            console.error("Upload Failed:", error);
            throw error;
        }
    },

    /**
     * 3. Trigger the processing
     */
    triggerProcessing: async (slug) => {
        try {
            const response = await fetch(`${BASE_URL}/${slug}/trigger`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${LUMA_API_KEY}`,
                },
            });
            return await response.json();
        } catch (error) {
            console.error("Trigger Failed:", error);
            throw error;
        }
    }
};