FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY frontend/package.json frontend/
RUN npm install -w @banking/frontend
COPY frontend frontend
WORKDIR /app/frontend
EXPOSE 5173
# Map SPLUNK_* from env_file to VITE_* for the dev server (Vite only exposes VITE_ prefixed vars)
CMD ["sh", "-c", "export VITE_SPLUNK_REALM=\"${SPLUNK_REALM:-${VITE_SPLUNK_REALM:-us1}}\" VITE_SPLUNK_RUM_ACCESS_TOKEN=\"${SPLUNK_RUM_ACCESS_TOKEN:-${VITE_SPLUNK_RUM_ACCESS_TOKEN:-}}\" VITE_DEPLOYMENT_ENVIRONMENT=\"${VITE_DEPLOYMENT_ENVIRONMENT:-banking-app}\" && npm run dev -- --host 0.0.0.0"]
