import {
  AutoDownloadMode,
  DiscoveryVisibility,
  FontSizeLevel,
  LocationVisibility,
  MediaQualityLevel,
  MessageDensityLevel,
  VisibilityLevel,
} from '@prisma/client';

export function toVisibilityLevel(v: string): VisibilityLevel {
  const map: Record<string, VisibilityLevel> = {
    everyone: VisibilityLevel.EVERYONE,
    contacts: VisibilityLevel.CONTACTS,
    nobody: VisibilityLevel.NOBODY,
  };
  return map[v] ?? VisibilityLevel.EVERYONE;
}

export function fromVisibilityLevel(v: VisibilityLevel): string {
  return v.toLowerCase();
}

export function toAutoDownload(v: string): AutoDownloadMode {
  const map: Record<string, AutoDownloadMode> = {
    wifi: AutoDownloadMode.WIFI,
    always: AutoDownloadMode.ALWAYS,
    never: AutoDownloadMode.NEVER,
  };
  return map[v] ?? AutoDownloadMode.WIFI;
}

export function fromAutoDownload(v: AutoDownloadMode): string {
  return v === AutoDownloadMode.WIFI ? 'wifi' : v.toLowerCase();
}

export function toMediaQuality(v: string): MediaQualityLevel {
  return v === 'standard' ? MediaQualityLevel.STANDARD : MediaQualityLevel.HIGH;
}

export function fromMediaQuality(v: MediaQualityLevel): string {
  return v.toLowerCase();
}

export function toFontSize(v: string): FontSizeLevel {
  const map: Record<string, FontSizeLevel> = {
    small: FontSizeLevel.SMALL,
    medium: FontSizeLevel.MEDIUM,
    large: FontSizeLevel.LARGE,
  };
  return map[v] ?? FontSizeLevel.MEDIUM;
}

export function fromFontSize(v: FontSizeLevel): string {
  return v.toLowerCase();
}

export function toDensity(v: string): MessageDensityLevel {
  const map: Record<string, MessageDensityLevel> = {
    compact: MessageDensityLevel.COMPACT,
    comfortable: MessageDensityLevel.COMFORTABLE,
    spacious: MessageDensityLevel.SPACIOUS,
  };
  return map[v] ?? MessageDensityLevel.COMFORTABLE;
}

export function fromDensity(v: MessageDensityLevel): string {
  return v.toLowerCase();
}

export function toLocationVisibility(v: string): LocationVisibility {
  const map: Record<string, LocationVisibility> = {
    exact: LocationVisibility.EXACT,
    approximate: LocationVisibility.APPROXIMATE,
    city: LocationVisibility.CITY,
    hidden: LocationVisibility.HIDDEN,
  };
  return map[v] ?? LocationVisibility.APPROXIMATE;
}

export function fromLocationVisibility(v: LocationVisibility): string {
  return v.toLowerCase();
}

export function toDiscoveryVisibility(v: string): DiscoveryVisibility {
  const map: Record<string, DiscoveryVisibility> = {
    everyone: DiscoveryVisibility.EVERYONE,
    friends_of_friends: DiscoveryVisibility.FRIENDS_OF_FRIENDS,
    hidden: DiscoveryVisibility.HIDDEN,
  };
  return map[v] ?? DiscoveryVisibility.EVERYONE;
}

export function fromDiscoveryVisibility(v: DiscoveryVisibility): string {
  return v === DiscoveryVisibility.FRIENDS_OF_FRIENDS
    ? 'friends_of_friends'
    : v.toLowerCase();
}
