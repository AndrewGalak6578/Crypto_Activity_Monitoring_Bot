const { Client, Collection, IntentsBitField, EmbedBuilder } = require('discord.js');
const token = require('./token.js');
const fs = require('fs');
const { error } = require('console');

const channelId = '1136349594465337354';

function createNotification(project) {
  return new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('НАПОМИНАНИЕ ПРИОРИТЕТ - ' + project.приоритет)
    .setDescription(`Название проекта: ${project.название}\nОписание задачи: ${project.описание_задачи}\nСтатус задачи: ${project.статус_задачи}\nСсылка: ${project.ссылка}\n ID: ${project.project_id}`);
};


function sendNotifications() {
  const now = Date.now();

  for (const project of client.projectsData) {
    const daysSinceLastNotification = (now - (project.lastNotification || 0)) / (1000 * 60 * 60 * 24);
    let notifyInterval;

    switch (project.приоритет) {
      case 10:
        notifyInterval = 1;
        break;
      case 9:
        notifyInterval = 1.5;
        break;
      case 8:
        notifyInterval = 2;
        break;
      case 7:
        notifyInterval = 2.5;
        break;
      case 6:
      default:
        notifyInterval = 3;
        break;
    }

    if (daysSinceLastNotification >= notifyInterval) {
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        const notification = createNotification(project);
        channel.send({ content: `<@${project.user_id}>`, embeds: [notification] });
      }

      project.lastNotification = now;
    }
  }

  writeDataToFile({ projects: client.projectsData });
};
function readDataFromFile() {
  try {
    const jsonData = fs.readFileSync('projects.json', 'utf-8');
    const data = JSON.parse(jsonData);
    return data;
  } catch (error) {
    console.error('Ошибка при чтении данных из файла: ', error);
    return null;
  };
};
function writeDataToFile(data) {
  try {
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync('projects.json', jsonData);
  } catch (error) {
    console.error('Ошибка при записи данных в файл: ', error);
  };
};

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildInvites,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.DirectMessageReactions,
    IntentsBitField.Flags.GuildPresences,
  ],
  allowedMentions: {
    repliedUser: false
  },
});

client.commands = new Collection();
client.slashCommands = new Collection();
const data = readDataFromFile();
if (data && data.projects) {
  client.projectsData = data.projects;
} else {
  client.projectsData = [];
}

client.on('messageCreate', async (message) => {
  console.log(message.content);
});

// Обработчик для slash-команды /pong
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'change_status') {
    const projectId = interaction.options.getInteger('id-проекта');
    const newStatus = interaction.options.getString('статус-проекта');

    const project = client.projectsData.find(p => p.project_id === projectId && p.user_id === interaction.user.id);

    if (!project) {
        await interaction.reply('Проект с указанным ID не найден или у вас нет прав на его изменение.');
        return;
    }

    project.статус_задачи = newStatus;
    writeDataToFile({ projects: client.projectsData }); // сохраняем изменения в файл

    await interaction.reply(`Статус проекта с ID ${projectId} успешно изменен на "${newStatus}".`);
};

  if (commandName === 'show_projects') {
    const projectStatus = interaction.options.getString('статус-проекта');
    const userProjects = client.projectsData.filter(project => project.user_id === interaction.user.id);

    let filteredProjects;
    if (projectStatus === 'получены награды') {
        filteredProjects = userProjects.filter(project => project.статус_задачи === 'Готово, вознаграждение получено в размере');
    } else {
        filteredProjects = userProjects.filter(project => project.статус_задачи !== 'Готово, вознаграждение получено в размере');
    }

    if (filteredProjects.length === 0) {
        await interaction.reply('У вас нет проектов с выбранным статусом.');
        return;
    }
    if (filteredProjects.length === 0) {
      await interaction.reply('У вас нет проектов.');
      return;
    }

    let page = 0;
    const embed = new EmbedBuilder()
      .setTitle('Ваши проекты')
      .setDescription(filteredProjects.slice(page * 10, (page + 1) * 10).map((project, index) => `${index + 1}. ${project.название} ID: ${project.project_id}  Статус: ${project.статус_задачи}`).join('\n'));

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });

    if (filteredProjects.length > 10) {
      await message.react('⬅️');
      await message.react('➡️');

      const filter = (reaction, user) => ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id === interaction.user.id;
      const collector = message.createReactionCollector({ filter, time: 60000 });

      collector.on('collect', (reaction, user) => {
        reaction.users.remove(user.id);

        if (reaction.emoji.name === '⬅️') {
          if (page > 0) {
            page--;
          }
        } else if (reaction.emoji.name === '➡️') {
          if (page < Math.ceil(filteredProjects.length / 10) - 1) {
            page++;
          }
        }

        const newEmbed = new EmbedBuilder()
          .setColor('#FFFF00')
          .setTitle('Ваши проекты')
          .setDescription(filteredProjects.slice(page * 10, (page + 1) * 10).map((project, index) => `${index + 1}. ${project.название}  ID: ${project.project_id}  Статус: ${project.статус_задачи}`).join('\n'));

        message.edit({ embeds: [newEmbed] });
      });

      collector.on('end', async () => {
        try {
          await message.reactions.removeAll();
        } catch (error) {
          if (error.code !== 10008) { // Если это не ошибка "Unknown Message"
            console.error('Ошибка при удалении реакций:', error);
          }
        }
      });
    }
  }

  if (commandName === 'send_notification') {
    // Получение названия проекта из опций команды
    const projectId = options.getInteger('id-проекта');

    // Поиск проектов с соответствующим названием
    const projects = client.projectsData.filter(project => project.project_id === projectId);

    // Проверка, найдены ли какие-либо проекты
    if (projects.length === 0) {
      await interaction.reply('Проект с таким названием не найден.');
      return;
    }

    // Отправка уведомлений для каждого найденного проекта
    const channel = client.channels.cache.get(channelId);
    if (channel) {
      for (const project of projects) {
        const notification = createNotification(project);
        await channel.send({ content: `<@${project.user_id}>`, embeds: [notification] });
      }
    }

    await interaction.reply('Уведомления отправлены.');
  };

  if (commandName === 'pong') {
    // Получение аргументов из опций команды
    const arg1 = options.getString('название-проекта');
    const arg2 = options.getString('описание-проекта');
    const arg3 = options.getString('описание-задачи');
    const arg4 = options.getString('ссылка-на-проект');
    const arg5 = options.getString('статус-задачи');
    const arg6 = options.getInteger('приоритет');

    // Проверка аргументов на наличие и тип
    if (!arg1 || !arg2 || !arg3 || !arg4 || !arg5 || !arg6 || isNaN(arg6) || arg6 < 1 || arg6 > 10) {
      await interaction.reply('Неверные аргументы. Пожалуйста, укажите 5 текстовых аргументов и 1 число от 1 до 10.');
      return;
    }
    try {
      const projectData = {
        название: arg1,
        описание: arg2,
        описание_задачи: arg3,
        ссылка: arg4,
        статус_задачи: arg5,
        приоритет: arg6,
        user_id: interaction.user.id,
        project_id: 0,
      };
      const userProjects = client.projectsData.filter(project => project.user_id === interaction.user.id);
      let maxProjectId = 0;
      if (userProjects.length > 0) {
        maxProjectId = Math.max(...userProjects.map(project => project.project_id));
      };
      projectData.project_id = maxProjectId + 1;
      client.projectsData.push(projectData);
      // Ваш код для обработки команды /pong с аргументами
      await interaction.reply(`Вы ввели аргументы: ${arg1}, ${arg2}, ${arg3}, ${arg4}, ${arg5}, ${arg6}`);
      writeDataToFile({ projects: client.projectsData });
    } catch (error) {
      console.error('Ошибка при выполнении команды /pong:', error);
      await interaction.reply('Произошла ошибка при выполнении команды. Пожалуйста, попробуйте позже.', error);
    }
  }
});

// Создание slash-команды /pong после подключения к Discord API и готовности бота
client.once('ready', async () => {
  console.log(`${client.user.tag} запустился!`);
  setInterval(sendNotifications, 1000 * 60 * 60);

  try {
    const command = await client.application.commands.create({
      name: 'pong',
      description: 'Отправить аргументы',
      options: [
        {
          type: 3,
          name: 'название-проекта',
          description: 'Текстовый аргумент 1',
          required: true,
        },
        {
          type: 3,
          name: 'описание-проекта',
          description: 'Текстовый аргумент 2',
          required: true,
        },
        {
          type: 3,
          name: 'описание-задачи',
          description: 'Текстовый аргумент 3',
          required: true,
        },
        {
          type: 3,
          name: 'ссылка-на-проект',
          description: 'Текстовый аргумент 4',
          required: true,
        },
        {
          type: 3,
          name: 'статус-задачи',
          description: 'Текстовый аргумент 5',
          required: true,
          choices: [
            { name: 'выполнил и жду вознаграждения', value: 'выполнил и жду вознаграждения' },
            { name: 'Выполнил 1 раз, надо выполнить еще пару раз', value: 'Выполнил 1 раз, надо выполнить еще пару раз' },
            { name: 'Выполнил несколько раз, надо еще парочку', value: 'Выполнил несколько раз, надо еще парочку' },
            { name: 'Готово, вознаграждение получено в размере', value: 'Готово, вознаграждение получено в размере' },
          ],
        },
        {
          type: 4,
          name: 'приоритет',
          description: 'Числовой аргумент от 1 до 10',
          required: true,
          choices: [
            { name: '1', value: 1 },
            { name: '2', value: 2 },
            { name: '3', value: 3 },
            { name: '4', value: 4 },
            { name: '5', value: 5 },
            { name: '6', value: 6 },
            { name: '7', value: 7 },
            { name: '8', value: 8 },
            { name: '9', value: 9 },
            { name: '10', value: 10 },
          ],
        },
      ],
    });
    console.log('Slash-команда создана:', command);
    const notification_send = await client.application.commands.create({
      name: 'send_notification',
      description: 'Отправляет информацию о проекте',
      options: [
        {
          type: 4,
          name: 'id-проекта',
          description: 'Вы можете посмотреть id выших проектов через /show_projects',
          required: true,
        }
      ]
    });
    const showProjectsCommand = await client.application.commands.create({
      name: 'show_projects',
      description: 'Показывает ваши проекты',
      options: [
        {
          type: 3,
          name: 'статус-проекта',
          description: 'укажите статус выведенных проектов',
          required: true,
          choices: [
            {name: 'получены награды', value: 'получены награды'},
            {name: 'не получены награды', value: 'не получены награды'},
          ]
        }
      ]
    }); 
    const changeStatusCommand = await client.application.commands.create({
      name: 'change_status',
      description: 'Изменяет статус вашего проекта',
      options: [
          {
              type: 4,
              name: 'id-проекта',
              description: 'ID проекта, который вы хотите изменить',
              required: true,
          },
          {
              type: 3,
              name: 'статус-проекта',
              description: 'Новый статус проекта',
              required: true,
              choices: [
                  { name: 'выполнил и жду вознаграждения', value: 'выполнил и жду вознаграждения' },
                  { name: 'Выполнил 1 раз, надо выполнить еще пару раз', value: 'Выполнил 1 раз, надо выполнить еще пару раз' },
                  { name: 'Выполнил несколько раз, надо еще парочку', value: 'Выполнил несколько раз, надо еще парочку' },
                  { name: 'Готово, вознаграждение получено в размере', value: 'Готово, вознаграждение получено в размере' },
              ]
          }
      ]
  });
    
  } catch (error) {
    console.error('Ошибка при создании slash-команды:', error);
  };

});
client.on('messageDelete', async (message) => {
  if (message.author.id !== client.user.id) return; // Если сообщение не от бота, игнорируем
  if (!message.embeds || message.embeds.length === 0) return; // Если у сообщения нет embed, игнорируем

  const embedTitle = message.embeds[0].title;
  if (embedTitle === 'Ваши проекты') {
    // Сообщение было нашим embed-сообщением с проектами
    const channel = message.channel;
    await channel.send('Пожалуйста, не удаляйте уведомления с проектами!');

  }
});
client.login(token);