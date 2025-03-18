function getBodyContent() {
  try {
    console.log("getting body content");
    const textContent = document.body.innerText;
    const htmlContent = document.documentElement.outerHTML;

    const title = document.title;
    const url = window.location.href;

    const mainContent = Array.from(
      document.querySelectorAll('main, article, [role="main"]')
    )
      .map((el) => el.innerText)
      .join("\n");

    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, h5, h6")
    )
      .map((h) => `${h.tagName}: ${h.innerText}`)
      .join("\n");

    return {
      title,
      url,
      mainContent: mainContent || textContent,
      headings,
      textContent,
      htmlContent,
    };
  } catch (error) {
    console.error("Error getting body content:", error);
    return {
      title: document.title || "",
      url: window.location.href || "",
      mainContent: "",
      headings: "",
      textContent: "",
      htmlContent: "",
      error: error.message,
    };
  }
}
