
interface ClimateData {
    current: {
        temperature: number;
        windSpeed: number;
        windDirection: number;
        weatherCode: number;
    };
    hourly: Array<{
        time: string;
        temperature: number;
        windSpeed: number;
        windDirection: number;
        weatherCode: number;
    }>;
}

export const fetchClimateData = async (lat: number, lon: number): Promise<ClimateData | null> => {
    try {
        // Fetch current weather AND hourly forecast for today
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,windspeed_10m,winddirection_10m,weathercode&forecast_days=1`
        );
        const data = await response.json();

        if (data.current_weather && data.hourly) {
            // Map hourly structure (Open-Meteo returns parallel arrays)
            const hourlyData = data.hourly.time.map((time: string, index: number) => ({
                time,
                temperature: data.hourly.temperature_2m[index],
                windSpeed: data.hourly.windspeed_10m[index],
                windDirection: data.hourly.winddirection_10m[index],
                weatherCode: data.hourly.weathercode[index]
            }));

            return {
                current: {
                    temperature: data.current_weather.temperature,
                    windSpeed: data.current_weather.windspeed,
                    windDirection: data.current_weather.winddirection,
                    weatherCode: data.current_weather.weathercode
                },
                hourly: hourlyData
            };
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch climate data:", error);
        return null;
    }
};
