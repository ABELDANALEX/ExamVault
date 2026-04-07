const app = require('./src/app');

const port = Number.parseInt(process.env.PORT || '3000', 10);

app.listen(port, () => {
  console.log(`ExamVault is running on http://localhost:${port}`);
});
