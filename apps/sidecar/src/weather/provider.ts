import type { WeatherContext } from '@music-coding/shared-types';
import { createLogger } from '../utils/logger';

const log = createLogger('weather');

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

// 默认坐标（北京），后续可通过权限获取用户位置
const DEFAULT_LATITUDE = 39.9042;
const DEFAULT_LONGITUDE = 116.4074;

// WMO 天气代码映射
const weatherCodeMap: Record<number, string> = {
  0: '晴',
  1: '大部晴朗',
  2: '多云',
  3: '阴天',
  45: '雾',
  48: '雾凇',
  51: '小毛毛雨',
  53: '毛毛雨',
  55: '大毛毛雨',
  61: '小雨',
  63: '中雨',
  65: '大雨',
  71: '小雪',
  73: '中雪',
  75: '大雪',
  80: '阵雨',
  81: '中阵雨',
  82: '大阵雨',
  95: '雷暴',
  96: '雷暴伴小冰雹',
  99: '雷暴伴大冰雹',
};

interface OpenMeteoResponse {
  current_weather: {
    temperature: number;
    weathercode: number;
    windspeed: number;
    time: string;
  };
}

// 城市坐标映射（可通过权限获取用户位置）
const cityCoordinates: Record<string, { lat: number; lon: number; name: string }> = {
  'beijing': { lat: 39.9042, lon: 116.4074, name: '北京' },
  'shanghai': { lat: 31.2304, lon: 121.4737, name: '上海' },
  'guangzhou': { lat: 23.1291, lon: 113.2644, name: '广州' },
  'shenzhen': { lat: 22.5431, lon: 114.0579, name: '深圳' },
  'hangzhou': { lat: 30.2741, lon: 120.1551, name: '杭州' },
  'chengdu': { lat: 30.5728, lon: 104.0668, name: '成都' },
  'wuhan': { lat: 30.5928, lon: 114.3055, name: '武汉' },
  'nanjing': { lat: 32.0603, lon: 118.7969, name: '南京' },
  'xian': { lat: 34.3416, lon: 108.9398, name: '西安' },
  'chongqing': { lat: 29.5630, lon: 106.5516, name: '重庆' },
};

export class WeatherProvider {
  private cachedWeather: WeatherContext | null = null;
  private cacheExpiry: number = 0;
  private cacheDurationMs = 30 * 60 * 1000; // 30 分钟缓存

  async getWeather(latitude?: number, longitude?: number): Promise<WeatherContext> {
    // 检查缓存
    if (this.cachedWeather && Date.now() < this.cacheExpiry) {
      return this.cachedWeather;
    }

    const lat = latitude ?? DEFAULT_LATITUDE;
    const lon = longitude ?? DEFAULT_LONGITUDE;

    // 根据坐标获取城市名称
    const city = this.getCityByCoordinates(lat, lon);

    try {
      const url = `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.status}`);
      }

      const data = (await response.json()) as OpenMeteoResponse;
      const { temperature, weathercode } = data.current_weather;

      const condition = this.mapWeatherCode(weathercode);
      const description = city
        ? `${condition} ${Math.round(temperature)}°C · ${city}`
        : `${condition} ${Math.round(temperature)}°C`;

      const weather: WeatherContext = {
        condition,
        temperature: Math.round(temperature),
        description,
        city,
      };

      // 更新缓存
      this.cachedWeather = weather;
      this.cacheExpiry = Date.now() + this.cacheDurationMs;

      return weather;
    } catch (err) {
      log.error(`获取天气失败: ${err}`);

      // 返回默认值
      return {
        condition: 'unknown',
        temperature: 0,
        description: '天气数据不可用',
        city,
      };
    }
  }

  // 根据坐标获取城市名称
  private getCityByCoordinates(lat: number, lon: number): string {
    // 简单的坐标匹配（后续可通过反向地理编码 API 获取精确城市）
    for (const city of Object.values(cityCoordinates)) {
      const distance = Math.sqrt(
        Math.pow(lat - city.lat, 2) + Math.pow(lon - city.lon, 2)
      );
      if (distance < 0.5) { // 约 50km 范围内
        return city.name;
      }
    }
    return '未知城市';
  }

  private mapWeatherCode(code: number): string {
    return weatherCodeMap[code] || '未知';
  }
}
