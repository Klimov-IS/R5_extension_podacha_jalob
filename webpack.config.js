const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: './src/contents/complaints/main-world-entry.js',
  output: {
    filename: 'content-main-world.bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true, // Очищаем dist/ перед каждой сборкой
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: false, // Оставляем console.log для отладки
          },
          mangle: false, // Не обфусцируем имена переменных (для читаемости)
          format: {
            comments: false, // Убираем комментарии
          },
        },
        extractComments: false, // Не создаем отдельный файл с комментариями
      }),
    ],
  },
  // Source maps для отладки (опционально)
  devtool: false, // Выключаем для production (можно включить 'source-map' для отладки)
};
