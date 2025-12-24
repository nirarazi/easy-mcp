---
name: greet_user
description: Greets a user with a personalized message
parameters:
  name:
    type: string
    description: The name of the user to greet
  language:
    type: string
    description: The language for the greeting (e.g., 'en', 'es', 'fr')
    enum: ['en', 'es', 'fr', 'de']
    default: 'en'
required:
  - name
---

# Greet User Skill

This skill generates a personalized greeting for a user in their preferred language.

## Usage

The skill accepts a user's name and optional language preference, then returns a personalized greeting.

## Example

When called with:
- name: "Alice"
- language: "en"

It returns: "Hello, Alice! Welcome to our service."

## Implementation

The greeting is generated based on the language parameter:
- English (en): "Hello, {{name}}! Welcome to our service."
- Spanish (es): "¡Hola, {{name}}! Bienvenido a nuestro servicio."
- French (fr): "Bonjour, {{name}}! Bienvenue à notre service."
- German (de): "Hallo, {{name}}! Willkommen bei unserem Service."



