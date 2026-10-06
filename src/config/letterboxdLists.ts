// Public Letterboxd lists that can be synced to a Plex collection. `url` is the
// list's main page; `name` is what the sync page shows (and the title used if
// you choose to create a new Plex collection for it).

export type LetterboxdList = { name: string; url: string };

export const letterboxdLists: LetterboxdList[] = [
  { name: "Halloween", url: "https://letterboxd.com/pulotum/list/halloween/" },
  {
    name: "Project Daft Punk",
    url: "https://letterboxd.com/pulotum/list/project-daft-punk/",
  },
];
