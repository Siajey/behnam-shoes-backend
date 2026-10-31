import fastifyHelmet, { FastifyHelmetOptions } from '@fastify/helmet'
import { NestFastifyApplication } from '@nestjs/platform-fastify'

const ProdHelmetConfigs: FastifyHelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      connectSrc: ["'self'"],
    },
  },
  xssFilter: true,
  hidePoweredBy: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'no-referrer' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
}

const DevHelmetConfigs: FastifyHelmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'http://localhost:*'],
    },
  },
  hidePoweredBy: true,
  xssFilter: true,
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },
}

export const applyHelmet = async (app: NestFastifyApplication, nodeEnv: string) => {
  const HelmetConfigs = nodeEnv === 'production' ? ProdHelmetConfigs : DevHelmetConfigs
  await app.register(fastifyHelmet, HelmetConfigs)
}
