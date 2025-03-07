export function sanitizeFileName(fileName: string) {
    try {
        // Remove special characters like ?, #, etc.
        fileName = fileName.split("?")[0].split("#")[0].replace(/[^a-zA-Z0-9._-]/g, "");

        // Extract file extension
        const lastDotIndex = fileName.lastIndexOf(".");
        const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : "";
        let nameWithoutExt = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;

        // Ensure file name is within limit
        if (nameWithoutExt.length > 20) {
            nameWithoutExt = nameWithoutExt.substring(0, 20);
        }

        // Ensure file name is not empty
        if (!nameWithoutExt.trim()) {
            const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, "");
            nameWithoutExt = `file_${timestamp}`;
        }

        return nameWithoutExt + extension;
    } catch (error) {
        console.error("Error sanitizing file name:", error);
        return `file_${Date.now()}.txt`; // Default fallback
    }
}
