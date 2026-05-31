FROM php:8.2-apache

RUN apt-get update \
  && apt-get install -y --no-install-recommends libcurl4-openssl-dev libonig-dev \
  && docker-php-ext-install curl mbstring \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN echo "ServerName localhost" >> /etc/apache2/apache2.conf

COPY . /var/www/html/

EXPOSE 80
