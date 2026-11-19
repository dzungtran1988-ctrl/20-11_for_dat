/**
 * ============================================================================
 *  js/data.js — ALL PERSONAL CONTENT LIVES HERE
 * ============================================================================
 *  Edit the text between the quotes "..." to change what the website says.
 *  You never need to touch index.html, main.js or gallery.js just to change
 *  words or photos.
 *
 *  Safe-editing tips
 *   • Keep the straight quotes "..." around every piece of text.
 *   • Keep the comma , at the end of each line / item.
 *   • Need a quote mark inside a sentence? Use curly quotes “ ” instead of ".
 *   • "❤️" anywhere in the text is drawn as a small amber heart.
 *   • Leave a text as "" (empty) to hide that line completely.
 *   • After saving, hard-refresh the page (Cmd/Ctrl + Shift + R).
 *   • If the page shows "Không đọc được nội dung", you probably removed a
 *     comma or a quote by accident — the browser console names the line.
 * ============================================================================
 */

/**
 * FAMILY PHOTOS — prepackaged (visible to EVERYONE who opens the website)
 * ----------------------------------------------------------------------------
 *  1. Copy your photo files into  assets/images/
 *  2. Add one line per photo below (remove the // at the start of a line).
 *
 *     src     – path to the file. Case-sensitive on GitHub Pages:
 *               "Photo-01.JPG" and "photo-01.jpg" are different files!
 *     caption – a short handwritten-style caption (optional)
 *     date    – e.g. "Hè 2015" or "Tết 2020" (optional)
 *     size    – optional: "sm", "md" or "lg" to vary the polaroid size
 *
 *  Photos that cannot be found are skipped automatically (a warning is
 *  printed in the browser console so you can fix the path).
 */
const memories = [
  { src: "assets/images/bo.jpg", caption: "Người thầy của nhiều người, người bố của con", date: "" },
  { src: "assets/images/hoi-be.jpg", caption: "Hồi bé, trong vòng tay bố", date: "", size: "md" },
  { src: "assets/images/bo-va-con.jpg", caption: "Bố lo quả bóng, con lo đôi giày", date: "" },
  { src: "assets/images/ca-nha.jpg", caption: "Cả nhà mình, quây quần bên nhau", date: "", size: "lg" },
  // Thêm ảnh mới theo mẫu (tên file nên viết không dấu, không khoảng trắng):
  // { src: "assets/images/ten-anh.jpg", caption: "", date: "" },
];

window.SITE_DATA = {
  meta: {
    title: "Gửi bố — 20/11",
  },

  /* SECTION 1 — The envelope ------------------------------------------------ */
  envelope: {
    to: "Gửi bố",
    occasion: "nhân ngày 20/11",
    tagline: "Có một bất ngờ nhỏ dành cho người thầy đặc biệt nhất.",
    hint: "Chạm để mở thư",
    peek: "Bố à,", // the first words seen on the letter as it slides out
    openLabel: "Mở thư:", // read by screen readers before the envelope text
  },

  /* SECTION 2 — A message for Dad ------------------------------------------- */
  message: {
    eyebrow: "Nhân ngày Nhà giáo Việt Nam 20/11",
    // Each item is shown on its own line.
    quote: [
      "Với mọi người, bố là một người thầy đáng kính.",
      "Còn với con, bố luôn là người bố mà con thương yêu nhất.",
    ],
    intro:
      "Ngày 20/11 không chỉ là dịp để tri ân những người làm nghề giáo, mà còn là dịp để con nói với bố những điều đôi khi con chưa có cơ hội nói thành lời.",
    scrollHint: "Đọc tiếp",
  },

  /* SECTION 3 — Four flip cards ----------------------------------------------
   * icon: "book" | "sprout" | "feather" | "coffee" | "heart" | "home" | "star"
   */
  cards: {
    chapter: "I",
    eyebrow: "Những điều con muốn nói",
    title: "Bốn điều con muốn bố biết",
    lead: "Chạm vào từng tấm thẻ để đọc lời con viết.",
    flipHint: "Chạm để lật",
    flipBackHint: "Chạm để lật lại",
    items: [
      {
        icon: "book",
        front: "Người thầy mà con luôn ngưỡng mộ",
        back: "Con luôn trân trọng sự tận tụy mà bố dành cho công việc giảng dạy. Phía sau mỗi giờ lên lớp là rất nhiều sự chuẩn bị, trách nhiệm và tâm huyết mà không phải ai cũng nhìn thấy.",
      },
      {
        icon: "sprout",
        front: "Những điều bố đã âm thầm cố gắng",
        back: "Không phải mọi nỗ lực đều được nhìn thấy, và không phải mọi cố gắng đều nhận lại kết quả như mong đợi. Nhưng điều đó không làm những gì bố đã làm trở nên kém giá trị.",
      },
      {
        icon: "feather",
        front: "Bố cũng cần được nghỉ ngơi",
        back: "Con mong bố đừng lúc nào cũng phải gồng mình vì công việc hay những điều ngoài kia. Bố cũng xứng đáng có những ngày thật nhẹ nhàng, được làm điều mình thích và tận hưởng thời gian bên gia đình.",
      },
      {
        icon: "heart",
        front: "Niềm tự hào của con",
        back: "Con tự hào vì được là con của bố. Nhưng hơn cả những danh xưng hay thành tựu, điều con trân trọng nhất vẫn là tình cảm và sự hiện diện của bố trong gia đình.",
      },
    ],
  },

  /* SECTION 4 — Family memory gallery ---------------------------------------- */
  gallery: {
    chapter: "II",
    eyebrow: "Album gia đình",
    title: "Những khoảnh khắc của nhà mình",
    lead: "Một vài khoảnh khắc của gia đình mình, con muốn giữ lại ở đây.",
    emptyTitle: "Album này đang chờ những tấm ảnh của gia đình mình.",
    emptyText: "Thêm vài tấm ảnh để cùng lưu giữ ở đây nhé.",
    // true  → shows a small “Thêm ảnh vào album” panel (photos are saved only
    //         in the browser of the device where they were added — see README).
    // false → only the photos listed in `memories` above are shown.
    allowUploads: true,
    // true → hide the whole gallery section when there are no photos at all.
    hideWhenEmpty: false,
  },

  /* SECTION 5 — The main letter ---------------------------------------------- */
  letter: {
    chapter: "III",
    eyebrow: "Lá thư",
    title: "Những điều con muốn viết cho bố",
    dateLine: "Ngày 20 tháng 11 năm 2026",
    salutation: "Bố à,",
    // One item per paragraph.
    paragraphs: [
      "Ngày 20/11, mọi người thường dành những lời chúc tốt đẹp nhất cho những người làm nghề giáo. Với con, đây cũng là dịp để nhìn lại và cảm nhận nhiều hơn về những điều bố đã dành cho công việc, cho các thế hệ sinh viên và cho gia đình.",
      "Con biết phía sau công việc của một người thầy, một người làm khoa học là rất nhiều trách nhiệm, những ngày bận rộn và cả những điều không phải lúc nào cũng có thể chia sẻ cùng mọi người. Con luôn trân trọng sự tận tụy và những nỗ lực mà bố đã dành cho nghề nghiệp của mình.",
      "Bố này, con biết công việc ở trường đôi khi không chỉ có giảng dạy, nghiên cứu hay những điều mình yêu thích. Có những chuyện không phải lúc nào cũng diễn ra như mong muốn, có những nỗ lực không phải lúc nào cũng được thấu hiểu hay ghi nhận đúng cách.",
      "Con không biết hết những điều bố đã trải qua, nhưng con mong bố đừng vì những chuyện không vui ấy mà quên đi giá trị của chính mình. Những gì bố đã dành cho nghề giáo, cho sinh viên và cho gia đình không thể bị định nghĩa bởi một vài chuyện không như ý.",
      "Con mong bố vẫn giữ được niềm vui với những điều mình yêu thích, nhưng cũng đừng quên dành thời gian cho bản thân. Không phải chuyện gì bố cũng cần phải suy nghĩ hay gánh vác một mình đâu.",
      "Ở ngoài kia, bố có thể là một người thầy, một Phó Giáo sư với rất nhiều trách nhiệm. Nhưng khi trở về nhà, bố không cần phải mang theo tất cả những vai trò ấy. Bố cứ là bố thôi, vì gia đình luôn yêu thương bố như thế.",
    ],
    // Short closing lines, shown after a small pause.
    closing: [
      "Con mong những ngày sắp tới sẽ nhẹ nhàng hơn với bố.",
      "Cảm ơn bố vì đã luôn là bố của con.",
      "Chúc bố một ngày 20/11 thật nhiều niềm vui và bình an.",
      "Con yêu bố.",
    ],
    signature: "Con của bố ❤️",
  },

  /* SECTION 6 — The final hug ------------------------------------------------ */
  hug: {
    lead: "Cuối cùng, con chỉ muốn nói...",
    big: "Con yêu bố. ❤️",
    button: "Ôm bố một cái",
    buttonAgain: "Ôm bố thêm cái nữa",
    message:
      "Chúc bố luôn mạnh khỏe, vui vẻ và bình an. Mong rằng sau tất cả những bộn bề ngoài kia, bố luôn có một nơi để trở về và được là chính mình.",
  },

  /* Background music ---------------------------------------------------------
   * Put a real piano recording at assets/audio/piano.mp3.
   * If the file is missing, the music button simply does not appear.
   */
  music: {
    enabled: true,
    src: "assets/audio/piano.mp3",
    volume: 0.5, // 0 → 1
    // Remember “music on” on this device, so next time it starts when the
    // envelope is opened (it never starts by itself before a tap/click).
    rememberPreference: true,
  },

  footer: {
    text: "Một món quà nhỏ con làm tặng bố, nhân ngày 20/11.",
  },

  memories: memories,
};
