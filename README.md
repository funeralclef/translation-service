## 🌐 Мова | Language

[Українська](#echopulse---система-підтримки-прийняття-рішень-для-бюро-перекладів) | [English](#echopulse---decision-support-system-for-a-translation-bureau)


# EchoPulse - Система підтримки прийняття рішень для бюро перекладів

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## 📄 Про проект

EchoPulse - це система підтримки прийняття рішень для бюро перекладів. Система забезпечує автоматизацію процесів класифікації, оцінки складності та тематики перекладацьких замовлень, а також сприяє ефективному розподілу завдань між перекладачами.

### 🎓 Кваліфікаційна дипломна робота бакалавра
**Тема:** "Система підтримки прийняття рішень для бюро перекладів"

## 🚀 Основний функціонал

### 👥 Для клієнтів:
- Завантаження документів для перекладу
- Вибір мов перекладу
- Встановлення термінів виконання
- Відстеження статусу замовлень
- Автоматичний розрахунок вартості
- Аналіз тематики документів
- Рекомендаційна система для підбору перекладачів

### 👨‍💼 Для перекладачів:
- Пошук замовлень відповідно до навичок
- Автоматична класифікація складності замовлень
- Аналіз тематики документів
- Рекомендаційна система для підбору завдань

### 🛠️ Для адміністраторів:
- Управління користувачами
- Моніторинг замовлень

## 🤖 ШІ-функції

Система використовує штучний інтелект для:

- **Автоматичної класифікації замовлень** за тематикою та складністю
- **Оцінки часу та вартості** перекладу з урахуванням складності
- **Рекомендацій перекладачів** на основі профілю та досвіду

## 🛠️ Технологічний стек

### Frontend
- **Next.js 15** - React фреймворк з серверним рендерингом
- **TypeScript** - статична типізація
- **Tailwind CSS** - сучасні стилі
- **shadcn/ui** - доступні UI компоненти

### Backend & Database
- **Supabase** - база даних PostgreSQL та автентифікація
- **Row Level Security** - безпека на рівні рядків
- **Supabase Storage** - зберігання файлів

### AI & Processing
- **OpenAI API** - обробка природної мови
- **Mammoth.js** - парсинг DOCX документів

## 📊 Особливості системи

### 🔍 Автоматична класифікація замовлень
Система аналізує завантажені документи та автоматично визначає:
- Тематику документа (юридична, медична, технічна, літературна тощо)
- Рівень складності перекладу
- Приблизний час виконання
- Рекомендовану вартість

### 🎯 Рекомендаційна система
Алгоритм підбору перекладачів враховує:
- Спеціалізацію перекладача
- Рейтинг та відгуки
- Завантаженість
- Відповідність мовної пари

## 🔐 Безпека

- Row Level Security (RLS) політики
- Захищене зберігання файлів
- Приватні посилання на документи (signed URLs)

## 📝 Ліцензія

Цей проект є навчальним і розроблений в рамках дипломної роботи. Усі права належать автору.

## 👨‍💻 Автор

**Веріємчук Денис** - Дипломна робота
- Університет: Київський національний університет імені Тараса Шевеченка
- Факультет: Інформаційних технологій
- Спеціальність: Комп'ютерні науки


---


# EchoPulse - Decision Support System for a Translation Bureau

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

## 📄 About the Project

EchoPulse is a decision support system for translation bureaus. It automates the classification of translation orders, assesses their complexity and subject matter, and enables efficient task distribution among translators.

### 🎓 Qualification Bachelor's Thesis
**Title:** "Decision Support System for a Translation Bureau"

## 🚀 Key Features

### 👥 For Clients:
- Upload documents for translation
- Select source and target languages
- Set deadlines
- Track order status
- Automatic cost estimation
- Document topic analysis
- Translator recommendation system

### 👨‍💼 For Translators:
- Search for orders based on skills
- Automatic complexity classification
- Topic analysis
- Task recommendation system

### 🛠️ For Admins:
- User management
- Order monitoring

## 🤖 AI Features

The system uses AI to:

- **Automatically classify orders** by topic and complexity
- **Estimate translation time and cost** based on complexity
- **Recommend suitable translators** based on their profile and experience

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** – React framework with SSR
- **TypeScript** – static typing
- **Tailwind CSS** – utility-first styling
- **shadcn/ui** – accessible UI components

### Backend & Database
- **Supabase** – PostgreSQL database & authentication
- **Row Level Security** – per-row access control
- **Supabase Storage** – file storage

### AI & Processing
- **OpenAI API** – natural language processing
- **Mammoth.js** – DOCX file parsing

## 📊 System Capabilities

### 🔍 Automatic Order Classification
The system analyzes uploaded documents to determine:
- Topic (legal, medical, technical, literary, etc.)
- Complexity level
- Approximate completion time
- Recommended price

### 🎯 Recommendation Engine
The translator selection algorithm considers:
- Translator specialization
- Ratings and reviews
- Current workload
- Language pair compatibility

## 🔐 Security

- Row Level Security (RLS) policies
- Secure file storage
- Private signed document URLs

## 📝 License

This project is academic and was developed as part of a thesis. All rights reserved by the author.

## 👨‍💻 Author

**Denys Veriiemchuk** – Qualification Bachelor's Thesis 
- University: Taras Shevchenko National University of Kyiv  
- Faculty: Information Technology  
- Specialty: Computer Science

