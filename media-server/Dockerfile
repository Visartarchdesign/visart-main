FROM node:20-slim

# ffmpeg -- Montajchi agenti uchun oldindan o'rnatib qo'yamiz (hozircha
# ishlatilmaydi, lekin keyingi bosqichda qayta deploy qilmaslik uchun).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

ENV PORT=10000
EXPOSE 10000
CMD ["node", "index.js"]
