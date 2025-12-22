---
name: calculate
description: Performs basic mathematical calculations
parameters:
  operation:
    type: string
    description: The mathematical operation to perform
    enum: ['add', 'subtract', 'multiply', 'divide']
  a:
    type: number
    description: The first number
  b:
    type: number
    description: The second number
required:
  - operation
  - a
  - b
---

# Calculate Skill

This skill performs basic mathematical calculations between two numbers.

## Supported Operations

- **add**: Adds two numbers (a + b)
- **subtract**: Subtracts second number from first (a - b)
- **multiply**: Multiplies two numbers (a * b)
- **divide**: Divides first number by second (a / b)

## Example

When called with:
- operation: "add"
- a: 10
- b: 5

It returns: "The result of 10 + 5 is 15"

## Error Handling

If division by zero is attempted, the skill returns an error message.

