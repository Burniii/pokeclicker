import type { PureComputed } from 'knockout';
import Settings from '../settings/Settings';
import DayCycle from '../dayCycle/DayCycle';
import DayCyclePart from '../dayCycle/DayCyclePart';
import Weather from '../weather/Weather';
import WeatherType from '../weather/WeatherType';

const WEATHER_EFFECT: Partial<Record<WeatherType, string>> = {
    [WeatherType.Overcast]: 'overcast',
    [WeatherType.Rain]: 'rain',
    [WeatherType.Thunderstorm]: 'storm',
    [WeatherType.Snow]: 'snow',
    [WeatherType.Hail]: 'snow',
    [WeatherType.Blizzard]: 'blizzard',
    [WeatherType.Harsh_Sunlight]: 'sun',
    [WeatherType.Sandstorm]: 'sand',
    [WeatherType.Fog]: 'fog',
    [WeatherType.Windy]: 'wind',
};

// CSS classes for the animated map layers (day/night tint, weather, water, quest targets)
export default class MapEffects {
    public static classes: PureComputed<string> = ko.pureComputed(() => {
        const classes = ['map-effects'];
        if (Settings.getSetting('mapEffects.dayNight')?.observableValue()) {
            classes.push(`map-time-${DayCyclePart[DayCycle.currentDayCyclePart()]?.toLowerCase()}`);
        }
        if (Settings.getSetting('mapEffects.weather')?.observableValue()) {
            const effect = WEATHER_EFFECT[Weather.currentWeather()];
            if (effect) {
                classes.push(`map-weather-${effect}`);
            }
        }
        if (Settings.getSetting('mapEffects.water')?.observableValue()) {
            classes.push('map-water-animated');
        }
        if (Settings.getSetting('mapEffects.questPulse')?.observableValue()) {
            classes.push('map-quest-pulse');
        }
        return classes.join(' ');
    });
}
