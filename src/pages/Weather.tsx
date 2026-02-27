import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Cloud, MapPin, Calendar, Droplets, Wind, Thermometer, Eye, AlertTriangle, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CurrentWeather {
  temperature: number;
  humidity: number;
  wind_speed: number;
  feels_like: number;
  weather_code: number;
  condition: string;
}

interface ForecastDay {
  date: string;
  temp_max: number;
  temp_min: number;
  precipitation: number;
  wind_speed_max: number;
  weather_code: number;
  condition: string;
}

interface WeatherData {
  location: { name: string; country: string };
  current: CurrentWeather;
  forecast: ForecastDay[];
}

const getWeatherEmoji = (code: number) => {
  if (code === 0 || code === 1) return "☀️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 55) return "🌦️";
  if (code >= 61 && code <= 65) return "🌧️";
  if (code >= 71 && code <= 75) return "❄️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 95) return "⛈️";
  return "🌤️";
};

const Weather = () => {
  const { user } = useAuth();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [region, setRegion] = useState("Your Region");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        // Get farmer's region
        const { data: profile } = await supabase
          .from("profiles")
          .select("region")
          .eq("id", user.id)
          .single();

        const userRegion = profile?.region || "Delhi";
        setRegion(userRegion);

        console.log("Fetching live weather for region:", userRegion);

        // Call edge function
        const { data, error: fnError } = await supabase.functions.invoke("weather-api", {
          body: { region: userRegion },
        });

        if (fnError) {
          console.error("Weather function error:", fnError);
          setError("Failed to fetch weather data. Please try again.");
          toast.error("Weather data unavailable");
          setLoading(false);
          return;
        }

        if (data?.error) {
          console.error("Weather API error:", data.error);
          setError(data.error);
          toast.error(data.error);
          setLoading(false);
          return;
        }

        console.log("Weather data received:", data);
        setWeather(data);
      } catch (err) {
        console.error("Weather fetch error:", err);
        setError("An unexpected error occurred while fetching weather data.");
        toast.error("Failed to load weather");
      }
      setLoading(false);
    };
    fetchWeather();
  }, [user]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <Cloud className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-display font-bold text-agri-orange uppercase tracking-wide">Weather Intelligence Center</h1>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {region}</span>
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {today}</span>
        <span className="ml-auto">Real-time weather data for smart farming decisions</span>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl p-8 text-center card-shadow border border-border">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-muted-foreground">Fetching live weather data...</p>
        </div>
      ) : error ? (
        <div className="bg-card rounded-xl p-8 text-center card-shadow border border-border">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-agri-amber" />
          <p className="text-foreground font-medium mb-1">Weather Data Unavailable</p>
          <p className="text-muted-foreground text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : weather ? (
        <>
          {/* Current */}
          <div className="agri-gradient-warm rounded-2xl p-8 text-primary-foreground grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex items-center gap-6">
              <span className="text-6xl">{getWeatherEmoji(weather.current.weather_code)}</span>
              <div>
                <p className="text-xs uppercase tracking-wider opacity-80">Current Weather</p>
                <p className="text-6xl font-display font-bold">{Math.round(weather.current.temperature)}°</p>
                <p className="text-sm opacity-80">• {weather.current.condition}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 bg-primary-foreground/10 rounded-xl p-4">
              {[
                { label: "Humidity", value: `${weather.current.humidity}%`, icon: Droplets },
                { label: "Wind Speed", value: `${weather.current.wind_speed} km/h`, icon: Wind },
                { label: "Feels Like", value: `${Math.round(weather.current.feels_like)}°C`, icon: Thermometer },
                { label: "Location", value: weather.location.name, icon: Eye },
              ].map((i) => (
                <div key={i.label} className="flex items-center gap-2">
                  <i.icon className="w-4 h-4 opacity-80" />
                  <div>
                    <p className="text-[10px] uppercase opacity-70">{i.label}</p>
                    <p className="font-display font-bold text-sm">{i.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 5-Day Forecast */}
          <div className="bg-card rounded-xl p-6 card-shadow border border-border">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">5-Day Forecast</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {weather.forecast.map((day) => (
                <div key={day.date} className="text-center p-3 rounded-xl border border-border">
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(day.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <p className="text-2xl my-2">{getWeatherEmoji(day.weather_code)}</p>
                  <p className="font-display font-bold text-sm">{Math.round(day.temp_max)}° / {Math.round(day.temp_min)}°</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{day.condition}</p>
                  {day.precipitation > 0 && <p className="text-[10px] text-agri-teal mt-1">💧{day.precipitation}mm</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-card rounded-xl p-6 card-shadow border border-border">
            <h2 className="text-xs font-bold uppercase tracking-wider text-agri-orange flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4" /> Weather Alerts
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weather.current.temperature > 35 && (
                <div className="flex items-start gap-3">
                  <span className="px-2 py-0.5 bg-agri-amber/20 text-agri-amber text-[10px] font-bold rounded-full">Moderate</span>
                  <div>
                    <p className="font-semibold text-sm">High Temperature Alert</p>
                    <p className="text-xs text-muted-foreground">Temperature is above 35°C. Ensure adequate irrigation.</p>
                  </div>
                </div>
              )}
              {weather.forecast.some(d => d.precipitation > 10) && (
                <div className="flex items-start gap-3">
                  <span className="px-2 py-0.5 bg-agri-blue/20 text-agri-blue text-[10px] font-bold rounded-full flex items-center gap-1"><Info className="w-3 h-3" /> Info</span>
                  <div>
                    <p className="font-semibold text-sm">Heavy Rainfall Expected</p>
                    <p className="text-xs text-muted-foreground">Rainfall exceeds 10mm in forecast. Check drainage systems.</p>
                  </div>
                </div>
              )}
              {weather.current.wind_speed > 40 && (
                <div className="flex items-start gap-3">
                  <span className="px-2 py-0.5 bg-agri-amber/20 text-agri-amber text-[10px] font-bold rounded-full">Warning</span>
                  <div>
                    <p className="font-semibold text-sm">High Wind Alert</p>
                    <p className="text-xs text-muted-foreground">Wind speed above 40 km/h. Secure crops and equipment.</p>
                  </div>
                </div>
              )}
              {weather.current.temperature <= 35 && weather.current.wind_speed <= 40 && !weather.forecast.some(d => d.precipitation > 10) && (
                <div className="flex items-start gap-3">
                  <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded-full">Normal</span>
                  <div>
                    <p className="font-semibold text-sm">Conditions Favorable</p>
                    <p className="text-xs text-muted-foreground">Weather conditions are normal for farming operations.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Weather;
