---
name: get_weather
description: Gets weather information for a specific location
parameters:
  location:
    type: string
    description: The city or location name (e.g., "New York", "London")
  units:
    type: string
    description: Temperature units
    enum: ['celsius', 'fahrenheit']
    default: 'celsius'
required:
  - location
---

# Get Weather Skill

This skill retrieves weather information for a given location.

## Usage

Provide a location name and optionally specify temperature units (celsius or fahrenheit).

## Example

When called with:
- location: "San Francisco"
- units: "fahrenheit"

It returns weather information for San Francisco in Fahrenheit.

## Note

This is a template skill. In a real implementation, this would:
- Make an API call to a weather service (e.g., OpenWeatherMap)
- Parse the response
- Return formatted weather data

For now, it returns a placeholder message with the location and units.

