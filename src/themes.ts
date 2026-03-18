import githubHlCss from 'highlight.js/styles/github.css?inline';
import githubDarkHlCss from 'highlight.js/styles/github-dark.css?inline';
import draculaHlCss from 'highlight.js/styles/base16/dracula.css?inline';
import nordHlCss from 'highlight.js/styles/nord.css?inline';
import solarizedHlCss from 'highlight.js/styles/base16/solarized-light.css?inline';
import monokaiHlCss from 'highlight.js/styles/monokai.css?inline';

export type ThemeId = 'github-light' | 'github-dark' | 'dracula' | 'nord' | 'solarized-light' | 'monokai';

export interface ThemeDef {
  id: ThemeId;
  label: string;
  dark: boolean;
  hlCss: string;
}

export const THEMES: ThemeDef[] = [
  { id: 'github-light',    label: 'GitHub Light', dark: false, hlCss: githubHlCss },
  { id: 'github-dark',     label: 'GitHub Dark',  dark: true,  hlCss: githubDarkHlCss },
  { id: 'monokai',         label: 'Monokai',       dark: true,  hlCss: monokaiHlCss },
  { id: 'dracula',         label: 'Dracula',       dark: true,  hlCss: draculaHlCss },
  { id: 'nord',            label: 'Nord',          dark: true,  hlCss: nordHlCss },
  { id: 'solarized-light', label: 'Solarized',     dark: false, hlCss: solarizedHlCss },
];
