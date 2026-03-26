import { Amplify } from 'aws-amplify'

const config = {
  Auth: {
    Cognito: {
      userPoolId:       import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      loginWith: {
        email: true,
      },
    },
  },
}

console.log('[FinOps] Amplify config:', {
  userPoolId:       import.meta.env.VITE_COGNITO_USER_POOL_ID,
  userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  apiUrl:           import.meta.env.VITE_API_URL,
  region:           import.meta.env.VITE_AWS_REGION,
})

Amplify.configure(config)

export const API_URL = import.meta.env.VITE_API_URL || ''
