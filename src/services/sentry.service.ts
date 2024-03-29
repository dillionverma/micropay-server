import * as Sentry from "@sentry/node";
import "@sentry/tracing";
import { config } from "../config";

Sentry.init({
  dsn: config.sentryDsn,
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
  ],

  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

export default Sentry;
