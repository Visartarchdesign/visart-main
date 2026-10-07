FROM node:20-slim

# ffmpeg -- Montajchi agenti uchun. cmake/g++/git/python3/make -- whisper.cpp'ni
# (nodejs-whisper paketi orqali, manbadan) qurish uchun kerak -- subtitr
# generatsiyasi shunga tayanadi.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg cmake g++ git python3 make \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# Whisper.cpp'ni qurib, "tiny" ko'p-tilli modelni OLDINDAN (build bosqichida)
# yuklab, image ichiga joylab qo'yamiz -- runtime'da internet/vaqt sarflanmaydi.
# MUHIM: Render BEPUL TARIFI 512MB RAM bilan cheklangan -- "base" modeli ~500MB
# RAM talab qiladi (deyarli butun limitni yeydi, ilovani OOM bilan o'ldirishi
# mumkin), shuning uchun "tiny" (~390MB RAM) ishlatiladi. Kelajakda to'lov
# rejasiga o'tilsa, shu qatorni "small\nn\n" ga almashtirib qayta deploy qilish
# orqali aniqlikni oshirish mumkin (va quyidagi WHISPER_MODEL ni ham moslang).
RUN printf 'tiny\nn\n' | npx nodejs-whisper download

COPY . .

ENV PORT=10000
ENV WHISPER_MODEL=tiny
EXPOSE 10000
CMD ["node", "index.js"]
