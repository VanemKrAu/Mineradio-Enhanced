import { z } from "zod";
import { TrackSchema } from "./track";

export const WeatherLocationSchema = z.object({
  name: z.string(),
  country: z.string().optional().default(""),
  admin1: z.string().optional().default(""),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string().optional().default(""),
  fallback: z.boolean().optional().default(false)
});

export const WeatherMoodSchema = z.object({
  key: z.string(),
  title: z.string(),
  tagline: z.string(),
  energy: z.number(),
  warmth: z.number(),
  focus: z.number(),
  melancholy: z.number(),
  keywords: z.array(z.string()).default([])
});

export const WeatherSnapshotSchema = z.object({
  provider: z.string(),
  location: WeatherLocationSchema,
  label: z.string(),
  weatherCode: z.number().nullable(),
  temperature: z.number().nullable(),
  apparentTemperature: z.number().nullable(),
  humidity: z.number().nullable(),
  precipitation: z.number().nullable(),
  cloudCover: z.number().nullable(),
  windSpeed: z.number().nullable(),
  windGusts: z.number().nullable(),
  isDay: z.number().nullable(),
  time: z.string().optional().default(""),
  updatedAt: z.number(),
  error: z.string().optional().default(""),
  mood: WeatherMoodSchema
});

export const WeatherRadioSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  seedQueries: z.array(z.string()).default([]),
  songs: z.array(TrackSchema).default([]),
  updatedAt: z.number()
});

export const WeatherRadioResponseSchema = z.object({
  ok: z.literal(true),
  weather: WeatherSnapshotSchema,
  radio: WeatherRadioSchema
});

export type WeatherLocation = z.infer<typeof WeatherLocationSchema>;
export type WeatherMood = z.infer<typeof WeatherMoodSchema>;
export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;
export type WeatherRadio = z.infer<typeof WeatherRadioSchema>;
export type WeatherRadioResponse = z.infer<typeof WeatherRadioResponseSchema>;
