import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { region } = await req.json();
    if (!region) {
      return new Response(JSON.stringify({ error: "Region is required" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log("Fetching weather for region:", region);

    // Step 1: Geocode the region name to lat/lon using Open-Meteo Geocoding API (free, no key)
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(region)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      return new Response(JSON.stringify({ error: `Could not find location: ${region}` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { latitude, longitude, name, country } = geoData.results[0];
    console.log(`Geocoded ${region} to ${name}, ${country} (${latitude}, ${longitude})`);

    // Step 2: Fetch current weather + 5-day forecast from Open-Meteo (free, no key)
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=5`
    );
    const weatherData = await weatherRes.json();

    if (weatherData.error) {
      console.error("Open-Meteo error:", weatherData.reason);
      return new Response(JSON.stringify({ error: "Weather API error" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map weather codes to descriptions
    const weatherCodeMap: Record<number, string> = {
      0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
      45: "Foggy", 48: "Depositing rime fog",
      51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
      61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
      71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
      80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
      95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
    };

    const current = weatherData.current;
    const daily = weatherData.daily;

    const result = {
      location: { name, country, latitude, longitude },
      current: {
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        wind_speed: current.wind_speed_10m,
        feels_like: current.apparent_temperature,
        weather_code: current.weather_code,
        condition: weatherCodeMap[current.weather_code] || "Unknown",
      },
      forecast: daily.time.map((date: string, i: number) => ({
        date,
        temp_max: daily.temperature_2m_max[i],
        temp_min: daily.temperature_2m_min[i],
        precipitation: daily.precipitation_sum[i],
        wind_speed_max: daily.wind_speed_10m_max[i],
        weather_code: daily.weather_code[i],
        condition: weatherCodeMap[daily.weather_code[i]] || "Unknown",
      })),
    };

    console.log("Weather data fetched successfully");

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Weather API error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
