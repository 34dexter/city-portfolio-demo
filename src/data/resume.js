// All portfolio content lives here. Edit this file to update the site.

export const profile = {
    name: 'Punith B',
    title: 'ECE Engineer · Developer · Data & ML',
    location: 'Bangalore, India',
    email: '34punithb@gmail.com',
    // Phone is left out of the public site on purpose. Add it here if you want it shown.
    phone: '',
    portfolio: 'https://34dexter.github.io/portfolio',
    github: 'https://github.com/34dexter',
    // Paste your LinkedIn profile URL here. The link stays hidden while this is empty.
    linkedin: '',
    summary:
        'Electronics and Communication Engineering graduate with 4 months of experience as a Sports Data Analyst at HUDL India (November 2024 to March 2025). ' +
        'Skilled in Python, JavaScript, HTML, CSS, React, Node.js, MongoDB, and basic SQL. Knowledge of manual, regression, and smoke testing. ' +
        'Works with GitHub, Visual Studio Code, Jupyter Notebook, and Microsoft Office, and uses AI tools such as Claude, ChatGPT, and Muse.'
}

export const skills = [
    {
        category: 'Programming & Web',
        color: '#ff7a59',
        items: [ 'Python', 'HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'MongoDB', 'SQL' ]
    },
    {
        category: 'Testing',
        color: '#4fb3ff',
        items: [ 'Manual', 'Regression', 'Smoke' ]
    },
    {
        category: 'AI Tools',
        color: '#b77dff',
        items: [ 'Claude', 'ChatGPT', 'Muse' ]
    },
    {
        category: 'Tools',
        color: '#3fc58a',
        items: [ 'VS Code', 'Jupyter', 'MS Office', 'GitHub' ]
    }
]

export const experience = {
    internship: {
        role: 'Machine Learning Intern',
        company: 'Take It Smart (OPC) Pvt. Ltd.',
        project: 'Cardiac Arrhythmia Prediction Using Random Forest',
        points: [
            'Built a machine learning model in Python to predict cardiac arrhythmia.',
            'Trained the model on datasets imported through scikit-learn.',
            'Applied the Random Forest algorithm for classification and prediction.',
            'Used NumPy for numerical computation and Matplotlib for data visualization.'
        ],
        tags: [ 'Python', 'scikit-learn', 'Random Forest', 'NumPy', 'Matplotlib' ]
    },
    hudl: {
        role: 'Sports Data Analyst',
        company: 'HUDL India',
        period: 'November 2024 – March 2025 (4 months)',
        points: [
            'Worked as a Sports Data Analyst for 4 months, November 2024 to March 2025.'
        ],
        tags: [ 'Sports data', 'Analysis' ]
    }
}

export const projects = {
    eventPlanner: {
        title: 'Event Planner Website (Front-End)',
        tech: [ 'HTML', 'CSS', 'JavaScript' ],
        points: [
            'Built the front end of a website for an event planner using HTML, CSS, and JavaScript.'
        ],
        url: 'https://34dexter.github.io/Eventrra._/',
        urlLabel: 'Visit the live site'
    },
    boneCancer: {
        title: 'Bone Cancer Prediction Using Deep Neural Networks',
        subtitle: 'Final-year project',
        tech: [ 'Python', 'TensorFlow', 'Keras', 'Jupyter Notebook' ],
        points: [
            'Developed a deep learning model to predict bone cancer from immunohistochemistry (IHC) images.',
            'Pre-processed IHC images and extracted features using a DNN with the VGG16 model.',
            'Performed detection by comparing the extracted feature values.'
        ]
    },
    solarTracker: {
        title: 'Dual-Axis Solar Tracker',
        subtitle: 'Mini project',
        tech: [ 'Embedded Systems', 'Arduino', 'Arduino IDE', 'LDR sensors', 'Servo motors' ],
        points: [
            'Designed a solar panel system that detects the direction of the most intense sunlight and automatically aligns itself towards it.',
            'Used LDR sensors for light detection and servo motors for two-axis movement, controlled by an Arduino.',
            'Improved energy capture compared with a fixed, stationary solar panel.'
        ]
    }
}

export const education = {
    degree: 'Bachelor of Engineering (BE)',
    field: 'Electronics and Communication Engineering',
    school: 'Rajarajeswari College of Engineering',
    location: 'Bangalore',
    year: '2023'
}
