// src/utils.js
export const formatDate = (date: any) => new Date(date).toLocaleDateString();

export const formatTime = (date: any) => {
	const time = new Date(date).toLocaleTimeString('en-US', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		second: undefined,
	});
	// Lowercase am/pm and remove space before it
	return time.replace(/\s*([AP]M)$/i, (_, ampm) => ampm.toLowerCase());
};