FROM node:20-slim

# ffmpeg -- Montajchi agenti uchun. cmake/g++/git/python3/make -- whisper.cpp'ni
# (nodejs-whisper paketi orqali, manbadan) qurish uchun kerak -- subtitr
# generatsiyasi shunga tayanadi.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg cmake g++ git python3 make curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# Whisper.cpp'ni qurib, "tiny" ko'p-tilli modelni OLDINDAN (build bosqichida)
# yuklab, image ichiga joylab qo'yamiz -- runtime'da internet/vaqt sarflanmaydi.
# MUHIM: Render BEPUL TARIFI 512MB RAM bilan cheklangan -- "base" modeli ~500MB
# RAM talab qiladi (deyarli butun limitni yeydi, ilovani OOM bilan o'ldirishi
# mumkin), shuning uchun "tiny" (~390MB RAM) ishlatiladi. Kelajakda to'lov
# rejasiga o'tilsa, shu qatorni "small" ga almashtirib qayta deploy qilish
# orqali aniqlikni oshirish mumkin (va quyidagi WHISPER_MODEL ni ham moslang).
# `npx nodejs-whisper download` interaktiv (terminal so'raydi) va Docker build'da
# YIQILADI -- shu sababli bir xil amallarni (model yuklash + cmake build) qo'lda
# bajaramiz. -j2: Render build xotirasini ortiqcha yuklamaslik uchun.
RUN cd node_modules/nodejs-whisper/cpp/whisper.cpp/models \
  && sh ./download-ggml-model.sh tiny \
  && cd .. \
  && cmake -B build \
  && cmake --build build --config Release -j2 \
  && ls build/bin/whisper-cli models/ggml-tiny.bin

COPY . .

ENV PORT=10000
ENV WHISPER_MODEL=tiny
EXPOSE 10000
CMD ["node", "index.js"]
