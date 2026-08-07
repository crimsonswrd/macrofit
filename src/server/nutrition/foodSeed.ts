export type SeedFood = {
  name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  unit?: string;
};

export const FOOD_CATEGORIES = [
  'Мясо и птица',
  'Рыба и морепродукты',
  'Яйца и молочное',
  'Крупы и гарниры',
  'Бобовые',
  'Хлеб и выпечка',
  'Овощи',
  'Фрукты и ягоды',
  'Орехи и семена',
  'Масла и соусы',
  'Спортпит',
  'Сладости и снеки',
  'Напитки',
] as const;

/**
 * Curated food database. Values are per 100 g (or 100 ml where unit = 'мл'),
 * based on standard nutrient tables (USDA / Роспотребнадзор).
 */
export const seedFoods: SeedFood[] = [
  // --- Мясо и птица ---
  { name: 'Куриная грудка, филе (сырая)', category: 'Мясо и птица', calories: 113, protein: 23.6, carbs: 0, fat: 1.9 },
  { name: 'Куриная грудка, отварная', category: 'Мясо и птица', calories: 137, protein: 29.8, carbs: 0, fat: 1.8 },
  { name: 'Куриная грудка, гриль', category: 'Мясо и птица', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Куриное бедро без кожи (сырое)', category: 'Мясо и птица', calories: 168, protein: 19.7, carbs: 0, fat: 9.6 },
  { name: 'Индейка, филе грудки (сырое)', category: 'Мясо и птица', calories: 104, protein: 24, carbs: 0, fat: 0.7 },
  { name: 'Говядина, вырезка (сырая)', category: 'Мясо и птица', calories: 158, protein: 21.6, carbs: 0, fat: 7.5 },
  { name: 'Говяжий фарш 5% жирности', category: 'Мясо и птица', calories: 137, protein: 21.4, carbs: 0, fat: 5 },
  { name: 'Свинина, окорок (сырая)', category: 'Мясо и птица', calories: 183, protein: 20.5, carbs: 0, fat: 10.9 },
  { name: 'Телятина (сырая)', category: 'Мясо и птица', calories: 131, protein: 20.4, carbs: 0, fat: 5 },
  { name: 'Говяжья печень', category: 'Мясо и птица', calories: 135, protein: 20.4, carbs: 3.9, fat: 3.6 },
  { name: 'Кролик', category: 'Мясо и птица', calories: 156, protein: 21, carbs: 0, fat: 8 },
  { name: 'Ветчина индейки', category: 'Мясо и птица', calories: 104, protein: 16, carbs: 2.5, fat: 3.4 },

  // --- Рыба и морепродукты ---
  { name: 'Лосось (сырой)', category: 'Рыба и морепродукты', calories: 208, protein: 20.4, carbs: 0, fat: 13.4 },
  { name: 'Тунец (сырой)', category: 'Рыба и морепродукты', calories: 109, protein: 24.4, carbs: 0, fat: 0.5 },
  { name: 'Тунец консервированный в с/с', category: 'Рыба и морепродукты', calories: 116, protein: 25.5, carbs: 0, fat: 0.8 },
  { name: 'Треска (сырая)', category: 'Рыба и морепродукты', calories: 82, protein: 17.8, carbs: 0, fat: 0.7 },
  { name: 'Минтай', category: 'Рыба и морепродукты', calories: 72, protein: 15.9, carbs: 0, fat: 0.9 },
  { name: 'Скумбрия', category: 'Рыба и морепродукты', calories: 205, protein: 18.6, carbs: 0, fat: 13.9 },
  { name: 'Сельдь атлантическая', category: 'Рыба и морепродукты', calories: 158, protein: 18, carbs: 0, fat: 9 },
  { name: 'Креветки (варёные)', category: 'Рыба и морепродукты', calories: 99, protein: 20.9, carbs: 0.2, fat: 1.4 },
  { name: 'Кальмар', category: 'Рыба и морепродукты', calories: 92, protein: 15.6, carbs: 3.1, fat: 1.4 },
  { name: 'Икра красная', category: 'Рыба и морепродукты', calories: 249, protein: 31.6, carbs: 0, fat: 13.8 },

  // --- Яйца и молочное ---
  { name: 'Яйцо куриное целое', category: 'Яйца и молочное', calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5 },
  { name: 'Яичный белок', category: 'Яйца и молочное', calories: 52, protein: 10.9, carbs: 0.7, fat: 0.2 },
  { name: 'Яичный желток', category: 'Яйца и молочное', calories: 322, protein: 15.9, carbs: 3.6, fat: 26.5 },
  { name: 'Творог 0%', category: 'Яйца и молочное', calories: 71, protein: 16.5, carbs: 1.3, fat: 0.1 },
  { name: 'Творог 5%', category: 'Яйца и молочное', calories: 121, protein: 17.2, carbs: 1.8, fat: 5 },
  { name: 'Творог 9%', category: 'Яйца и молочное', calories: 159, protein: 16.7, carbs: 2, fat: 9 },
  { name: 'Греческий йогурт 2%', category: 'Яйца и молочное', calories: 73, protein: 10, carbs: 3.6, fat: 2 },
  { name: 'Йогурт натуральный 3.2%', category: 'Яйца и молочное', calories: 66, protein: 5, carbs: 3.5, fat: 3.2 },
  { name: 'Кефир 1%', category: 'Яйца и молочное', calories: 40, protein: 3, carbs: 4, fat: 1, unit: 'мл' },
  { name: 'Молоко 2.5%', category: 'Яйца и молочное', calories: 52, protein: 2.8, carbs: 4.7, fat: 2.5, unit: 'мл' },
  { name: 'Молоко 3.2%', category: 'Яйца и молочное', calories: 59, protein: 2.9, carbs: 4.7, fat: 3.2, unit: 'мл' },
  { name: 'Сыр Гауда 45%', category: 'Яйца и молочное', calories: 356, protein: 25, carbs: 2.2, fat: 27 },
  { name: 'Сыр моцарелла', category: 'Яйца и молочное', calories: 280, protein: 22, carbs: 2.2, fat: 20 },
  { name: 'Сыр адыгейский', category: 'Яйца и молочное', calories: 240, protein: 19, carbs: 1.5, fat: 18 },
  { name: 'Сметана 15%', category: 'Яйца и молочное', calories: 162, protein: 2.6, carbs: 3.6, fat: 15 },
  { name: 'Масло сливочное 82.5%', category: 'Яйца и молочное', calories: 748, protein: 0.5, carbs: 0.8, fat: 82.5 },

  // --- Крупы и гарниры ---
  { name: 'Овсяные хлопья (сухие)', category: 'Крупы и гарниры', calories: 366, protein: 12.3, carbs: 61.8, fat: 6.1 },
  { name: 'Овсяная каша на воде', category: 'Крупы и гарниры', calories: 88, protein: 3, carbs: 15, fat: 1.7 },
  { name: 'Рис белый (сухой)', category: 'Крупы и гарниры', calories: 344, protein: 6.7, carbs: 78.9, fat: 0.7 },
  { name: 'Рис белый отварной', category: 'Крупы и гарниры', calories: 116, protein: 2.2, carbs: 25, fat: 0.5 },
  { name: 'Рис бурый (сухой)', category: 'Крупы и гарниры', calories: 337, protein: 7.4, carbs: 72.9, fat: 2.8 },
  { name: 'Гречка (сухая)', category: 'Крупы и гарниры', calories: 343, protein: 12.6, carbs: 62.1, fat: 3.3 },
  { name: 'Гречка отварная', category: 'Крупы и гарниры', calories: 110, protein: 4.2, carbs: 21.3, fat: 1.1 },
  { name: 'Киноа (сухая)', category: 'Крупы и гарниры', calories: 368, protein: 14.1, carbs: 57.2, fat: 6.1 },
  { name: 'Булгур (сухой)', category: 'Крупы и гарниры', calories: 342, protein: 12.3, carbs: 63.4, fat: 1.3 },
  { name: 'Макароны из твёрдых сортов (сухие)', category: 'Крупы и гарниры', calories: 355, protein: 12.5, carbs: 71.5, fat: 1.4 },
  { name: 'Макароны отварные', category: 'Крупы и гарниры', calories: 131, protein: 5, carbs: 25, fat: 1.1 },
  { name: 'Картофель отварной', category: 'Крупы и гарниры', calories: 82, protein: 2, carbs: 17, fat: 0.4 },
  { name: 'Батат (сырой)', category: 'Крупы и гарниры', calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1 },
  { name: 'Кускус (сухой)', category: 'Крупы и гарниры', calories: 376, protein: 12.8, carbs: 72.4, fat: 0.6 },
  { name: 'Перловка (сухая)', category: 'Крупы и гарниры', calories: 352, protein: 9.9, carbs: 73.6, fat: 1.2 },

  // --- Бобовые ---
  { name: 'Чечевица (сухая)', category: 'Бобовые', calories: 352, protein: 24.6, carbs: 63.4, fat: 1.1 },
  { name: 'Чечевица отварная', category: 'Бобовые', calories: 116, protein: 9, carbs: 20.1, fat: 0.4 },
  { name: 'Фасоль красная (сухая)', category: 'Бобовые', calories: 333, protein: 23.6, carbs: 60, fat: 0.8 },
  { name: 'Нут (сухой)', category: 'Бобовые', calories: 364, protein: 19.3, carbs: 61, fat: 6 },
  { name: 'Горошек зелёный', category: 'Бобовые', calories: 81, protein: 5.4, carbs: 14.5, fat: 0.4 },
  { name: 'Тофу', category: 'Бобовые', calories: 76, protein: 8.1, carbs: 1.9, fat: 4.8 },
  { name: 'Соевые бобы (сухие)', category: 'Бобовые', calories: 446, protein: 36.5, carbs: 30.2, fat: 19.9 },

  // --- Хлеб и выпечка ---
  { name: 'Хлеб цельнозерновой', category: 'Хлеб и выпечка', calories: 247, protein: 13, carbs: 41, fat: 3.4 },
  { name: 'Хлеб белый пшеничный', category: 'Хлеб и выпечка', calories: 265, protein: 9, carbs: 49, fat: 3.2 },
  { name: 'Хлеб ржаной', category: 'Хлеб и выпечка', calories: 250, protein: 8.5, carbs: 48.3, fat: 3.3 },
  { name: 'Лаваш тонкий', category: 'Хлеб и выпечка', calories: 275, protein: 9.1, carbs: 55.8, fat: 1.2 },
  { name: 'Рисовые хлебцы', category: 'Хлеб и выпечка', calories: 387, protein: 8, carbs: 81.5, fat: 3.5 },

  // --- Овощи ---
  { name: 'Брокколи', category: 'Овощи', calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4 },
  { name: 'Огурец', category: 'Овощи', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { name: 'Помидор', category: 'Овощи', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { name: 'Морковь', category: 'Овощи', calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2 },
  { name: 'Капуста белокочанная', category: 'Овощи', calories: 25, protein: 1.3, carbs: 5.8, fat: 0.1 },
  { name: 'Перец болгарский', category: 'Овощи', calories: 27, protein: 1, carbs: 6, fat: 0.3 },
  { name: 'Шпинат', category: 'Овощи', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { name: 'Кабачок', category: 'Овощи', calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  { name: 'Лук репчатый', category: 'Овощи', calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1 },
  { name: 'Шампиньоны', category: 'Овощи', calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3 },
  { name: 'Авокадо', category: 'Овощи', calories: 160, protein: 2, carbs: 8.5, fat: 14.7 },
  { name: 'Свёкла отварная', category: 'Овощи', calories: 44, protein: 1.7, carbs: 10, fat: 0.2 },

  // --- Фрукты и ягоды ---
  { name: 'Банан', category: 'Фрукты и ягоды', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
  { name: 'Яблоко', category: 'Фрукты и ягоды', calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2 },
  { name: 'Апельсин', category: 'Фрукты и ягоды', calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1 },
  { name: 'Виноград', category: 'Фрукты и ягоды', calories: 69, protein: 0.7, carbs: 18.1, fat: 0.2 },
  { name: 'Черника', category: 'Фрукты и ягоды', calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3 },
  { name: 'Клубника', category: 'Фрукты и ягоды', calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3 },
  { name: 'Малина', category: 'Фрукты и ягоды', calories: 52, protein: 1.2, carbs: 11.9, fat: 0.7 },
  { name: 'Киви', category: 'Фрукты и ягоды', calories: 61, protein: 1.1, carbs: 14.7, fat: 0.5 },
  { name: 'Груша', category: 'Фрукты и ягоды', calories: 57, protein: 0.4, carbs: 15.2, fat: 0.1 },
  { name: 'Финики сушёные', category: 'Фрукты и ягоды', calories: 282, protein: 2.5, carbs: 75, fat: 0.4 },
  { name: 'Изюм', category: 'Фрукты и ягоды', calories: 299, protein: 3.1, carbs: 79.2, fat: 0.5 },

  // --- Орехи и семена ---
  { name: 'Миндаль', category: 'Орехи и семена', calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9 },
  { name: 'Грецкий орех', category: 'Орехи и семена', calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2 },
  { name: 'Кешью', category: 'Орехи и семена', calories: 553, protein: 18.2, carbs: 30.2, fat: 43.9 },
  { name: 'Фундук', category: 'Орехи и семена', calories: 628, protein: 15, carbs: 16.7, fat: 60.8 },
  { name: 'Арахис', category: 'Орехи и семена', calories: 567, protein: 25.8, carbs: 16.1, fat: 49.2 },
  { name: 'Арахисовая паста', category: 'Орехи и семена', calories: 588, protein: 25, carbs: 20, fat: 50 },
  { name: 'Семена чиа', category: 'Орехи и семена', calories: 486, protein: 16.5, carbs: 42.1, fat: 30.7 },
  { name: 'Семена льна', category: 'Орехи и семена', calories: 534, protein: 18.3, carbs: 28.9, fat: 42.2 },
  { name: 'Тыквенные семечки', category: 'Орехи и семена', calories: 559, protein: 30.2, carbs: 10.7, fat: 49 },

  // --- Масла и соусы ---
  { name: 'Оливковое масло', category: 'Масла и соусы', calories: 884, protein: 0, carbs: 0, fat: 100, unit: 'мл' },
  { name: 'Растительное масло', category: 'Масла и соусы', calories: 899, protein: 0, carbs: 0, fat: 99.9, unit: 'мл' },
  { name: 'Майонез 67%', category: 'Масла и соусы', calories: 627, protein: 1, carbs: 2.6, fat: 67 },
  { name: 'Кетчуп', category: 'Масла и соусы', calories: 93, protein: 1.2, carbs: 22.2, fat: 0.2 },
  { name: 'Соевый соус', category: 'Масла и соусы', calories: 53, protein: 8.1, carbs: 4.9, fat: 0, unit: 'мл' },
  { name: 'Горчица', category: 'Масла и соусы', calories: 143, protein: 9.9, carbs: 5.3, fat: 12.7 },

  // --- Спортпит ---
  { name: 'Сывороточный протеин (изолят)', category: 'Спортпит', calories: 373, protein: 85, carbs: 3, fat: 2 },
  { name: 'Сывороточный протеин (концентрат)', category: 'Спортпит', calories: 400, protein: 75, carbs: 8, fat: 6 },
  { name: 'Казеиновый протеин', category: 'Спортпит', calories: 370, protein: 80, carbs: 5, fat: 2.5 },
  { name: 'Гейнер', category: 'Спортпит', calories: 380, protein: 20, carbs: 65, fat: 4 },
  { name: 'Креатин моногидрат', category: 'Спортпит', calories: 0, protein: 0, carbs: 0, fat: 0 },
  { name: 'BCAA порошок', category: 'Спортпит', calories: 380, protein: 95, carbs: 0, fat: 0 },
  { name: 'Мальтодекстрин', category: 'Спортпит', calories: 380, protein: 0, carbs: 95, fat: 0 },
  { name: 'Протеиновый батончик (средний)', category: 'Спортпит', calories: 350, protein: 30, carbs: 35, fat: 9 },
  { name: 'Изотоник готовый', category: 'Спортпит', calories: 26, protein: 0, carbs: 6.4, fat: 0, unit: 'мл' },

  // --- Сладости и снеки ---
  { name: 'Мёд', category: 'Сладости и снеки', calories: 304, protein: 0.3, carbs: 82.4, fat: 0 },
  { name: 'Шоколад тёмный 70%', category: 'Сладости и снеки', calories: 598, protein: 7.8, carbs: 45.9, fat: 42.6 },
  { name: 'Шоколад молочный', category: 'Сладости и снеки', calories: 535, protein: 7.6, carbs: 59.4, fat: 29.7 },
  { name: 'Сахар белый', category: 'Сладости и снеки', calories: 387, protein: 0, carbs: 99.8, fat: 0 },
  { name: 'Мармелад', category: 'Сладости и снеки', calories: 321, protein: 0.4, carbs: 79, fat: 0.1 },
  { name: 'Чипсы картофельные', category: 'Сладости и снеки', calories: 536, protein: 6.6, carbs: 53, fat: 34.6 },
  { name: 'Печенье овсяное', category: 'Сладости и снеки', calories: 437, protein: 6.5, carbs: 71.4, fat: 14.2 },

  // --- Напитки ---
  { name: 'Кофе чёрный без сахара', category: 'Напитки', calories: 2, protein: 0.1, carbs: 0, fat: 0, unit: 'мл' },
  { name: 'Чай без сахара', category: 'Напитки', calories: 1, protein: 0, carbs: 0.2, fat: 0, unit: 'мл' },
  { name: 'Апельсиновый сок', category: 'Напитки', calories: 45, protein: 0.7, carbs: 10.4, fat: 0.2, unit: 'мл' },
  { name: 'Кола', category: 'Напитки', calories: 42, protein: 0, carbs: 10.6, fat: 0, unit: 'мл' },
  { name: 'Миндальное молоко без сахара', category: 'Напитки', calories: 17, protein: 0.6, carbs: 0.6, fat: 1.2, unit: 'мл' },
  { name: 'Пиво светлое 4.5%', category: 'Напитки', calories: 43, protein: 0.5, carbs: 3.6, fat: 0, unit: 'мл' },
];
