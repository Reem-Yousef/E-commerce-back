import Joi from "joi";

const allowedDomains = [
  'gmail.com', 
  'yahoo.com', 
  'outlook.com', 
  'hotmail.com',
  'company.eg', 
  'edu.eg',
  'org.eg',
  'gov.eg'
];

const domainRegex = new RegExp(
  `^[a-zA-Z0-9._%+-]+@(${allowedDomains.map(d => d.replace(/\./g, '\\.')).join('|')})$`,
  'i' 
);

export const userValidationSchemaSignUp = Joi.object({
  username: Joi.string()
    .min(3)
    .max(20)
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9_]+$/) 
    .required()
    .messages({
      "string.base": "Username must be a string",
      "string.empty": "Username is required",
      "string.min": "Username must be at least 3 characters",
      "string.max": "Username must be at most 20 characters",
      "string.pattern.base": "Username can only contain letters, numbers, and underscore",
      "any.required": "Username is required",
    }),

  email: Joi.string()
    .email({ 
      minDomainSegments: 2,
      tlds: { allow: false } 
    })
    .pattern(domainRegex)
    .trim()
    .lowercase()
    .required()
    .messages({
      "string.email": "Please enter a valid email address",
      "string.empty": "Email is required",
      "string.pattern.base": `Email must use one of these domains: ${allowedDomains.join(', ')}`,
      "any.required": "Email is required",
    }),

  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters",
      "string.pattern.base": "Password must include uppercase, lowercase, number, and special character",
      "string.empty": "Password is required",
      "any.required": "Password is required",
    }),

  
  phoneNumbers: Joi.array()
    .items(
      Joi.string()
        .pattern(/^(\+20|0)?1[0-2|5][0-9]{8}$/) 
        .messages({
          "string.pattern.base": "Please enter a valid Egyptian phone number (e.g., 01xxxxxxxxx or +201xxxxxxxxx)"
        })
    )
    .min(1)
    .required()
    .messages({
      "array.base": "Phone numbers must be an array",
      "array.min": "At least one phone number is required",
      "any.required": "Phone numbers are required",
    }),

  addresses: Joi.array()
    .items(Joi.string().min(5).max(200))
    .min(1)
    .required()
    .messages({
      "array.base": "Addresses must be an array",
      "array.min": "At least one address is required",
      "string.min": "Address must be at least 5 characters",
      "any.required": "Addresses are required",
    }),

  age: Joi.number()
    .integer()
    .min(18)
    .max(80)
    .required()
    .messages({
      "number.base": "Age must be a number",
      "number.min": "You must be at least 18 years old",
      "number.max": "Age cannot exceed 100 years",
      "any.required": "Age is required",
    }),

  isLoggedIn: Joi.boolean().optional(),
  createdAt: Joi.date().optional(),
});

export const userValidationSchemaSignIn = Joi.object({
  email: Joi.string()
    .email({ minDomainSegments: 2 })
    .pattern(domainRegex)
    .trim()
    .lowercase()
    .required()
    .messages({
      "string.email": "Please enter a valid email address",
      "string.empty": "Email is required",
      "string.pattern.base": `Email must use one of these domains: ${allowedDomains.join(', ')}`,
      "any.required": "Email is required",
    }),

  password: Joi.string()
    .required()
    .messages({
      "string.empty": "Password is required",
      "any.required": "Password is required",
    }),
});

export const isEmailAllowed = (email) => {
  const domain = email.split('@')[1];
  return allowedDomains.includes(domain?.toLowerCase());
};