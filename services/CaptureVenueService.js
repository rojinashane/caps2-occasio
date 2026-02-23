import axios from 'axios';

const BASE_URL = 'https://lumalabs.ai/api/v1/capture';
const LUMA_API_KEY = 'luma-3b662f02-f100-4ee8-bae5-eeb21d46377c-786a9ef2-658b-43ee-9e6d-36673abd1b1d'; // ⚠️ DO NOT expose in production

export const CaptureVenueService = {

    /**
     * 1️⃣ Create Capture Placeholder
     */
    createCapture: async (title = "New Venue Scan") => {
        try {
            const response = await fetch(BASE_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${LUMA_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ title }),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Create Capture Error:", data);
                throw new Error(data.detail || "Failed to create capture");
            }

            console.log("Capture Created:", data);
            return data; // { slug, upload_url }

        } catch (error) {
            console.error("Capture Creation Failed:", error.message);
            throw error;
        }
    },


    /**
     * 2️⃣ Upload Video to Luma (S3 pre-signed URL)
     */
    uploadVideo: async (uploadUrl, fileUri) => {
        try {
            const fileResponse = await fetch(fileUri);
            const blob = await fileResponse.blob();

            const uploadResponse = await axios.put(uploadUrl, blob, {
                headers: {
                    'Content-Type': 'video/mp4',
                },
                onUploadProgress: (progressEvent) => {
                    const percent = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    console.log(`Upload Progress: ${percent}%`);
                },
            });

            console.log("Upload Successful");
            return uploadResponse;

        } catch (error) {
            console.error("Upload Failed:", error.response?.data || error.message);
            throw error;
        }
    },


    /**
     * 3️⃣ Trigger Processing
     */
    triggerProcessing: async (slug) => {
        try {
            const response = await fetch(`${BASE_URL}/${slug}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${LUMA_API_KEY}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Trigger Error:", data);
                throw new Error(data.detail || "Processing trigger failed");
            }

            console.log("Processing Triggered:", data);
            return data;

        } catch (error) {
            console.error("Trigger Failed:", error.message);
            throw error;
        }
    },


    /**
     * 4️⃣ Check Capture Status
     */
    getCaptureStatus: async (slug) => {
        try {
            const response = await fetch(`${BASE_URL}/${slug}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${LUMA_API_KEY}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Status Error:", data);
                throw new Error(data.detail || "Status check failed");
            }

            return data;

        } catch (error) {
            console.error("Status Check Failed:", error.message);
            throw error;
        }
    },


    /**
     * 5️⃣ Poll Until Completed
     */
    waitForCompletion: async (slug, interval = 15000) => {
        return new Promise((resolve, reject) => {

            const check = async () => {
                try {
                    const statusData = await CaptureVenueService.getCaptureStatus(slug);

                    console.log("Current Status:", statusData.status);

                    if (statusData.status === "completed") {
                        resolve(statusData);
                    } else if (statusData.status === "failed") {
                        reject("Processing failed.");
                    } else {
                        setTimeout(check, interval);
                    }

                } catch (error) {
                    reject(error);
                }
            };

            check();
        });
    }
};