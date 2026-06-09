import { initBotId } from 'botid/client/core'

initBotId({
  protect: [
    {
      path: '/api/chat',
      method: 'POST',
    },
    {
      path: '/api/auth/login',
      method: 'POST',
    },
    {
      path: '/api/projects',
      method: 'POST',
    },
    {
      path: '/api/projects/*',
      method: 'PUT',
    },
    {
      path: '/api/projects/*',
      method: 'DELETE',
    },
  ],
})
