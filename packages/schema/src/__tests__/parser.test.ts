import { describe, it, expect } from 'vitest';
import { parseAnvilYaml, AnvilError } from '../index.js';

const VALID_YAML = `
anvil: "1.0"
service:
  name: test-tools
  version: "1.0.0"
tools:
  hello:
    description: Say hello
    parameters:
      name:
        type: string
        required: true
    side_effects: none
    cost: free
`;

const FULL_YAML = `
anvil: "1.0"
service:
  name: weather-tools
  version: "2.0.0"
  description: Weather API
  base_url: https://api.weather.com
  auth:
    type: api_key
    header: X-API-Key
tools:
  get_weather:
    description: Get current weather
    agent:
      description: Use this tool for weather data
      when_to_use:
        - User asks about weather
      when_not_to_use:
        - User asks about forecasts
      tips:
        - Use city names
    parameters:
      location:
        type: string
        required: true
        description: City name
        validation:
          min_length: 1
      units:
        type: enum
        values: [celsius, fahrenheit]
        default: celsius
    returns:
      type: object
      properties:
        temp:
          type: number
    permissions:
      - type: network
        target: api.weather.com
        methods: [GET]
    rate_limit:
      requests: 100
      period: 1h
    errors:
      not_found:
        status: 404
        message: Location not found
        agent_hint: Ask user to clarify
    side_effects: none
    cost: low
    idempotent: true
    cache:
      ttl: 300
      vary_by: [location]
    examples:
      - name: basic
        input:
          location: San Francisco
          units: celsius
        output:
          temp: 18
        prompt: "What's the weather in SF?"
`;

describe('parseAnvilYaml', () => {
  it('parses a minimal valid definition', () => {
    const { service, warnings } = parseAnvilYaml(VALID_YAML);
    expect(service.anvil).toBe('1.0');
    expect(service.service.name).toBe('test-tools');
    expect(Object.keys(service.tools)).toEqual(['hello']);
    expect(service.tools['hello']!.parameters['name']!.type).toBe('string');
  });

  it('parses a full definition with all fields', () => {
    const { service } = parseAnvilYaml(FULL_YAML);
    expect(service.service.name).toBe('weather-tools');
    expect(service.service.auth?.type).toBe('api_key');

    const tool = service.tools['get_weather']!;
    expect(tool.agent?.when_to_use).toHaveLength(1);
    expect(tool.agent?.tips).toHaveLength(1);
    expect(tool.permissions).toHaveLength(1);
    expect(tool.errors?.['not_found']?.agent_hint).toBe('Ask user to clarify');
    expect(tool.examples).toHaveLength(1);
    expect(tool.cache?.ttl).toBe(300);
  });

  it('throws on empty input', () => {
    expect(() => parseAnvilYaml('')).toThrow(AnvilError);
  });

  it('throws on missing tools', () => {
    expect(() => parseAnvilYaml(`
anvil: "1.0"
service:
  name: test
  version: "1.0.0"
tools: {}
`)).toThrow();
  });

  it('throws on invalid tool name', () => {
    expect(() => parseAnvilYaml(`
anvil: "1.0"
service:
  name: test
  version: "1.0.0"
tools:
  InvalidName:
    description: Bad name
    parameters: {}
`)).toThrow();
  });
});
