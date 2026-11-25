import { profile, skills, experience, projects, education } from '../data/resume.js'

const esc = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const list = (items) => `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
const tags = (items) => `<div class="tags">${items.map((item) => `<span>${esc(item)}</span>`).join('')}</div>`
const link = (url, label) => `<a class="button" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`

export function contactLinks()
{
    const links = [
        { label: 'Email', value: profile.email, url: `mailto:${profile.email}` },
        { label: 'Portfolio', value: profile.portfolio.replace('https://', ''), url: profile.portfolio },
        { label: 'GitHub', value: profile.github.replace('https://', ''), url: profile.github },
    ]
    if(profile.linkedin)
        links.push({ label: 'LinkedIn', value: 'LinkedIn profile', url: profile.linkedin })
    if(profile.phone)
        links.push({ label: 'Phone', value: profile.phone, url: `tel:${profile.phone.replaceAll(' ', '')}` })
    return links
}

const sections = {
    about: () => `
        <p class="eyebrow">Welcome to my city</p>
        <h2>Hi, I'm ${esc(profile.name)}</h2>
        <p class="lead">${esc(profile.title)} · ${esc(profile.location)}</p>
        <p>${esc(profile.summary)}</p>
        <p class="hint">Drive around to visit each district: skills, experience, projects, education and contact. Every building has a story.</p>
    `,

    skills: () => `
        <p class="eyebrow">Skills district</p>
        <h2>Technical skills</h2>
        ${skills.map((group) => `
            <h3 style="--accent:${group.color}">${esc(group.category)}</h3>
            ${tags(group.items)}
        `).join('')}
        <p class="hint">Every crate in this district is a skill. Go ahead, knock them over.</p>
    `,

    internship: () =>
    {
        const job = experience.internship
        return `
            <p class="eyebrow">Experience</p>
            <h2>${esc(job.role)}</h2>
            <p class="lead">${esc(job.company)}</p>
            <h3>Project: ${esc(job.project)}</h3>
            ${list(job.points)}
            ${tags(job.tags)}
        `
    },

    hudl: () =>
    {
        const job = experience.hudl
        return `
            <p class="eyebrow">Experience</p>
            <h2>${esc(job.role)}</h2>
            <p class="lead">${esc(job.company)} · ${esc(job.period)}</p>
            ${list(job.points)}
            ${tags(job.tags)}
            <p class="hint">Try pushing the ball into the goal.</p>
        `
    },

    eventPlanner: () =>
    {
        const project = projects.eventPlanner
        return `
            <p class="eyebrow">Project</p>
            <h2>${esc(project.title)}</h2>
            ${tags(project.tech)}
            ${list(project.points)}
            ${link(project.url, project.urlLabel)}
        `
    },

    boneCancer: () =>
    {
        const project = projects.boneCancer
        return `
            <p class="eyebrow">Project · ${esc(project.subtitle)}</p>
            <h2>${esc(project.title)}</h2>
            ${tags(project.tech)}
            ${list(project.points)}
        `
    },

    solarTracker: () =>
    {
        const project = projects.solarTracker
        return `
            <p class="eyebrow">Project · ${esc(project.subtitle)}</p>
            <h2>${esc(project.title)}</h2>
            ${tags(project.tech)}
            ${list(project.points)}
            <p class="hint">The big panel here follows the sun through the day cycle, just like the real one.</p>
        `
    },

    education: () => `
        <p class="eyebrow">Education</p>
        <h2>${esc(education.degree)}</h2>
        <p class="lead">${esc(education.field)}</p>
        <p>${esc(education.school)}, ${esc(education.location)} · ${esc(education.year)}</p>
    `,

    contact: () => `
        <p class="eyebrow">Contact</p>
        <h2>Let's talk</h2>
        <p>I'm based in ${esc(profile.location)} and open to new opportunities.</p>
        <div class="contact-list">
            ${contactLinks().map((item) => `
                <a href="${esc(item.url)}" ${item.url.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}>
                    <strong>${esc(item.label)}</strong><span>${esc(item.value)}</span>
                </a>
            `).join('')}
        </div>
    `
}

export function getSectionHtml(key)
{
    return sections[key] ? sections[key]() : ''
}

// Full résumé in one scrollable panel, for visitors who prefer reading to driving.
export function getResumeHtml()
{
    const order = [ 'about', 'skills', 'internship', 'hudl', 'eventPlanner', 'boneCancer', 'solarTracker', 'education', 'contact' ]
    return order.map((key) => `<section class="resume-section">${getSectionHtml(key)}</section>`).join('')
}
