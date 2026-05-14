/_ LOCAL _/
npm install --omit=dev
npm run build
zip -r ../Desplegables/backend.zip dist node_modules package.json package-lock.json .env

/_ SERVER _/
pm2 delete base-api
cd /var/www/html/base.com/api
PORT=7777 pm2 start dist/main.js --name base-api
pm2 save
sudo service nginx restart

