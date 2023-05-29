const fsPromises = require("fs/promises");
const { google } = require("googleapis");
const { parse } = require("node-html-parser");
const core = require("@actions/core");
const matter = require("gray-matter");
const TurndownService = require("turndown");

async function main({ googleDriveFolderId, outputDirectoryPath }) {
  const drive = google.drive({
    auth: new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    }),
    version: "v3",
  });

  const exportedFiles = await exportFiles({
    drive,
    files: await listFiles({ drive, googleDriveFolderId }),
  });

  await createDirectory({ outputDirectoryPath });

  await writeExportedFiles({ exportedFiles, outputDirectoryPath });
}

async function createDirectory({ outputDirectoryPath }) {
  await fsPromises.stat(outputDirectoryPath).catch((err) => {
    if (err.code === "ENOENT") {
      fsPromises.mkdir(outputDirectoryPath, { recursive: true });
    }
  });
}

async function exportFile({ drive, fileId }) {
  const response = await drive.files.export({
    fileId,
    mimeType: "text/html",
  });
  return response.data;
}

async function exportFiles({ drive, files }) {
  return Promise.all(
    files.map(async (file) => {
      const html = await exportFile({
        drive,
        fileId: file.id,
      });
      return {
        ...file,
        html,
      };
    })
  );
}

async function listFiles({ drive, googleDriveFolderId }) {
  const response = await drive.files.list({
    fields: "nextPageToken, files(id, name, createdTime, modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: 1000,
    q: `'${googleDriveFolderId}' in parents and mimeType = 'application/vnd.google-apps.document'`,
  });
  return response.data.files;
}

function convertHtml(html) {
  const root = parse(html);
  const bodyElement = root.querySelector("body");

  bodyElement.querySelectorAll("*[style]").forEach((element) => {
    element.removeAttribute("style");
  });
  bodyElement.querySelectorAll("*[id]").forEach((element) => {
    element.removeAttribute("id");
  });
  bodyElement.querySelectorAll("p").forEach((element) => {
    if (element.innerHTML === "<span></span>") {
      element.remove();
    }
  });
  bodyElement.querySelectorAll("span").forEach((element) => {
    element.replaceWith(...element.childNodes);
  });
  bodyElement.querySelectorAll("a[href]").forEach((element) => {
    const href = element.getAttribute("href");
    if (!href) {
      return;
    }
    try {
      const url = new URL(href);
      const q = url.searchParams.get("q");
      element.setAttribute("href", q);
    } catch {
      // Ignore invalid URL in href (e.g. `"#cmnt_ref1"`).
    }
  });

  const firstElement = bodyElement.querySelector("*");
  const title = firstElement.text;
  firstElement.remove();

  const markdown = new TurndownService().turndown(bodyElement.innerHTML);

  return {
    body: markdown,
    title,
  };
}

async function writeExportedFiles({ exportedFiles, outputDirectoryPath }) {
  exportedFiles.forEach(async (exportedFile) => {
    const { body, title } = convertHtml(exportedFile.html);
    await fsPromises.writeFile(
      `${outputDirectoryPath}/${exportedFile.name}.md`,
      matter.stringify(body, { title })
    );
  });
}

main({
  googleDriveFolderId: core.getInput("google_drive_folder_id"),
  outputDirectoryPath: core.getInput("output_directory_path"),
}).catch(core.setFailed);
