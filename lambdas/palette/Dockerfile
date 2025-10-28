FROM public.ecr.aws/lambda/nodejs:20 AS build
WORKDIR /app

RUN dnf -y install zip && dnf clean all

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY index.mjs ./
RUN mkdir -p /out && zip -r /out/palette.zip ./*
