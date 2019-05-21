/*
global
  add_checkbox,
  cardQuality,
  cardStyle,
  cardSize,
  change_background,
  db,
  get_card_image,
  hideLoadingBars,
  ipc_send,
  offlineMode,
*/

const electron = require("electron");
const { createSelect } = require("../shared/select");

const remote = electron.remote;
const ipc = electron.ipcRenderer;
const shell = electron.shell;

let lastSettingsSection = 1;
let overlayAlpha = 1;
let overlayAlphaBack = 1;
let overlayScale = 1;
let cardSizePos = 4;
let settings = null;
let updateState = "";

const deckDrawer = require("../shared/deck-drawer");

const { CARD_TILE_ARENA, CARD_TILE_FLAT } = require("../shared/constants.js");

function getCardStyleName(style) {
  if (style == CARD_TILE_FLAT) return "Flat";
  return "Arena";
}

//
function openSettingsTab(openSection = lastSettingsSection) {
  lastSettingsSection = openSection;
  change_background("default");
  hideLoadingBars();
  $("#ux_0").off();
  $("#history_column").off();
  $("#ux_0").html("");
  $("#ux_0").addClass("flex_item");

  const wrap_l = $('<div class="wrapper_column sidebar_column_r"></div>');
  $(
    '<div class="settings_nav sn1" style="margin-top: 28px;" >Behaviour</div>'
  ).appendTo(wrap_l);
  $('<div class="settings_nav sn2">Overlay</div>').appendTo(wrap_l);
  $('<div class="settings_nav sn3">Visual</div>').appendTo(wrap_l);
  $('<div class="settings_nav sn4">Privacy</div>').appendTo(wrap_l);
  $('<div class="settings_nav sn5">About</div>').appendTo(wrap_l);

  if (offlineMode) {
    $('<div class="settings_nav sn6">Login</div>').appendTo(wrap_l);
  } else {
    $('<div class="settings_nav sn6">Logout</div>').appendTo(wrap_l);
  }

  const wrap_r = $('<div class="wrapper_column"></div>');
  const div = $('<div class="settings_page"></div>');
  let label, icd, section;

  // BEHAVIOR
  section = $('<div class="settings_section ss1"></div>');
  section.appendTo(div);
  section.append('<div class="settings_title">Behaviour</div>');

  add_checkbox(
    section,
    "Beta updates channel",
    "settings_betachannel",
    settings.beta_channel,
    updateAppSettings
  );
  add_checkbox(
    section,
    "Login automatically",
    "settings_autologin",
    settings.auto_login,
    updateAppSettings
  );
  add_checkbox(
    section,
    "Launch to tray",
    "settings_launchtotray",
    settings.launch_to_tray,
    updateAppSettings
  );
  add_checkbox(
    section,
    "Launch on startup",
    "settings_startup",
    settings.startup,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Read log on login",
    "settings_readlogonlogin",
    !settings.skip_firstpass,
    updateUserSettings
  );
  section.append(`
      <div class="settings_note">
      <i>Reading the log on startup can take a while, disabling this will make mtgatool load instantly, but you may have have to play with Arena to load some data, like Rank, wildcards and decklists. <b>This feature makes mtgatool read games when it was closed.</b></i>
      </div>`);
  add_checkbox(
    section,
    "Close main window on match found",
    "settings_closeonmatch",
    settings.close_on_match,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Close to tray",
    "settings_closetotray",
    settings.close_to_tray,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Sound when priority changes",
    "settings_soundpriority",
    settings.sound_priority,
    updateUserSettings
  );

  const sliderSoundVolume = $('<div class="slidecontainer_settings"></div>');
  sliderSoundVolume.appendTo(section);
  const sliderSoundVolumeLabel = $(
    `<label style="width: 400px;">Volume: ${Math.round(
      settings.sound_priority_volume * 100
    )}%</label>`
  );
  sliderSoundVolumeLabel.appendTo(sliderSoundVolume);
  const sliderSoundVolumeInput = $(
    '<input type="range" min="0" max="1" step=".001" value="' +
      settings.sound_priority_volume +
      '" class="slider sliderSoundVolume" id="settings_soundpriorityvolume">'
  );
  sliderSoundVolumeInput.appendTo(sliderSoundVolume);

  label = $('<label class="but_container_label">Export Format:</label>');
  label.appendTo(section);
  icd = $('<div class="input_container"></div>');
  const export_input = $(
    '<input type="search" id="settings_export_format" autocomplete="off" value="' +
      settings.export_format +
      '" />'
  );
  export_input.appendTo(icd);
  icd.appendTo(label);

  section.append(`<div class="settings_note">
      <i>Possible constiables: $Name, $Count, $SetName, $SetCode, $Collector, $Rarity, $Type, $Cmc</i>
      </div>`);

  // OVERLAY
  section = $('<div class="settings_section ss2"></div>');
  section.appendTo(div);
  section.append('<div class="settings_title">Overlay</div>');

  add_checkbox(
    section,
    "Always on top",
    "settings_overlay_ontop",
    settings.overlay_ontop,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Show overlay",
    "settings_showoverlay",
    settings.show_overlay,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Persistent overlay&nbsp;<i>(useful for OBS setup)</i>",
    "settings_showoverlayalways",
    settings.show_overlay_always,
    updateUserSettings
  );

  add_checkbox(
    section,
    "Show top bar",
    "settings_overlay_top",
    settings.overlay_top,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Show title",
    "settings_overlay_title",
    settings.overlay_title,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Show deck/lists",
    "settings_overlay_deck",
    settings.overlay_deck,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Show clock",
    "settings_overlay_clock",
    settings.overlay_clock,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Show sideboard",
    "settings_overlay_sideboard",
    settings.overlay_sideboard,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Compact lands",
    "settings_overlay_lands",
    settings.overlay_lands,
    updateUserSettings
  );

  const sliderOpacity = $('<div class="slidecontainer_settings"></div>');
  sliderOpacity.appendTo(section);
  const sliderOpacityLabel = $(
    '<label style="width: 400px; !important" class="card_size_container">Elements transparency: ' +
      transparencyFromAlpha(overlayAlpha) +
      "%</label>"
  );
  sliderOpacityLabel.appendTo(sliderOpacity);
  const sliderOpacityInput = $(
    '<input type="range" min="0" max="100" step="5" value="' +
      transparencyFromAlpha(overlayAlpha) +
      '" class="slider sliderB" id="opacityRange">'
  );
  sliderOpacityInput.appendTo(sliderOpacity);

  const sliderOpacityBack = $('<div class="slidecontainer_settings"></div>');
  sliderOpacityBack.appendTo(section);
  const sliderOpacityBackLabel = $(
    '<label style="width: 400px; !important" class="card_size_container">Background transparency: ' +
      transparencyFromAlpha(overlayAlphaBack) +
      "%</label>"
  );
  sliderOpacityBackLabel.appendTo(sliderOpacityBack);
  const sliderOpacityBackInput = $(
    '<input type="range" min="0" max="100" step="5" value="' +
      transparencyFromAlpha(overlayAlphaBack) +
      '" class="slider sliderC" id="opacityBackRange">'
  );
  sliderOpacityBackInput.appendTo(sliderOpacityBack);

  const sliderScale = $('<div class="slidecontainer_settings"></div>');
  sliderScale.appendTo(section);
  const sliderScaleLabel = $(
    '<label style="width: 400px; !important" class="card_size_container">Scale: ' +
      overlayScale +
      "%</label>"
  );
  sliderScaleLabel.appendTo(sliderScale);
  const sliderScaleInput = $(
    '<input type="range" min="10" max="200" step="10" value="' +
      overlayScale +
      '" class="slider sliderD" id="scaleRange">'
  );
  sliderScaleInput.appendTo(sliderScale);

  $(
    '<div class="button_simple centered resetOverlayPos">Reset Position</div>'
  ).appendTo(section);

  // VISUAL
  section = $('<div class="settings_section ss3"></div>');
  section.appendTo(div);
  section.append('<div class="settings_title">Visual</div>');

  label = $('<label class="but_container_label">Background URL:</label>');
  label.appendTo(section);

  icd = $('<div class="input_container"></div>');
  const url_input = $(
    '<input type="search" id="query_image" autocomplete="off" value="' +
      settings.back_url +
      '" />'
  );
  url_input.appendTo(icd);
  icd.appendTo(label);

  label = $('<label class="but_container_label">Background shade:</label>');
  const colorPick = $('<input type="text" id="flat" class="color_picker" />');
  colorPick.appendTo(label);
  label.appendTo(section);
  colorPick.spectrum({
    showInitial: true,
    showAlpha: true,
    showButtons: false
  });
  colorPick.spectrum("set", settings.back_color);

  colorPick.on("dragstop.spectrum", function(e, color) {
    $(".main_wrapper").css("background-color", color.toRgbString());
    updateUserSettings();
  });

  label = $('<label class="but_container_label">Cards quality:</label>');
  label.appendTo(section);

  const tagSelect = createSelect(
    label[0],
    ["small", "normal", "large"],
    cardQuality,
    filter => updateUserSettingsBlend({ cards_quality: filter }),
    "settings_cards_quality"
  );
  tagSelect.style.width = "180px";
  tagSelect.style.marginLeft = "32px";

  let cardsStyleCont = $(
    '<label class="but_container_label">Cards style:</label>'
  );

  const tagStyleSelect = createSelect(
    cardsStyleCont[0],
    [CARD_TILE_ARENA, CARD_TILE_FLAT],
    cardStyle,
    filter => {
      cardStyle = filter;
      updateUserSettingsBlend({ card_tile_style: filter });
    },
    "settings_cards_style",
    getCardStyleName
  );
  tagStyleSelect.style.width = "180px";
  tagStyleSelect.style.marginLeft = "32px";

  let tile = deckDrawer.cardTile(cardStyle, 67518, "a", 4);
  tile.style.width = "auto";
  cardsStyleCont.append(tile);
  section.append(cardsStyleCont);

  const slider = $('<div class="slidecontainer_settings"></div>');
  slider.appendTo(section);
  const sliderlabel = $(
    '<label style="width: 400px; !important" class="card_size_container">Cards size: ' +
      cardSize +
      "px</label>"
  );
  sliderlabel.appendTo(slider);
  const sliderInput = $(
    '<input type="range" min="0" max="20" value="' +
      cardSizePos +
      '" class="slider sliderA" id="myRange">'
  );
  sliderInput.appendTo(slider);

  const d = $(
    '<div style="width: ' +
      cardSize +
      'px; !important" class="inventory_card_settings"></div>'
  );
  const img = $(
    '<img style="width: ' +
      cardSize +
      'px; !important" class="inventory_card_settings_img"></img>'
  );

  const card = db.card(67518);
  img.attr("src", get_card_image(card));
  img.appendTo(d);

  d.appendTo(slider);

  // PRIVACY
  section = $('<div class="settings_section ss4"></div>');
  section.appendTo(div);
  section.append('<div class="settings_title">Privacy</div>');
  add_checkbox(
    section,
    "Anonymous sharing&nbsp;<i>(makes your username anonymous on Explore)</i>",
    "settings_anon_explore",
    settings.anon_explore,
    updateUserSettings
  );
  add_checkbox(
    section,
    "Online sharing&nbsp;<i>(when disabled, blocks any connections with our servers)</i>",
    "settings_senddata",
    settings.send_data,
    updateUserSettings
  );

  label = $('<label class="check_container_but"></label>');
  label.appendTo(section);
  let button = $(
    '<div class="button_simple button_long">Erase my shared data</div>'
  );
  button.on("click", eraseData);
  button.appendTo(label);

  // ABOUT
  section = $('<div class="settings_section ss5" style="height: 100%;"></div>');
  section.appendTo(div);
  //section.append('<div class="settings_title">About</div>');

  const about = $('<div class="about"></div>');
  about.append('<div class="top_logo_about"></div>');
  about.append(
    '<div class="message_sub_15 white">By Manuel Etchegaray, 2019</div>'
  );
  about.append(
    '<div class="message_sub_15 white">Version ' +
      remote.app.getVersion() +
      "</div>"
  );

  about.append('<div class="message_updates green">' + updateState + ".</div>");
  button = $(
    '<div class="button_simple centered update_link_about">Check for updates</div>'
  );
  button.appendTo(about);

  about.append(
    '<div class="flex_item" style="margin: 64px auto 0px auto;"><div class="discord_link"></div><div class="twitter_link"></div><div class="git_link"></div></div>'
  );
  about.append(
    '<div class="message_sub_15 white" style="margin: 24px 0 12px 0;">Support my work!</div><div class="donate_link"><img src="https://www.paypalobjects.com/webstatic/en_US/i/buttons/PP_logo_h_100x26.png" alt="PayPal" /></div>'
  );
  about.appendTo(section);

  // LOGIN
  section = $('<div class="settings_section ss6" style="height: 100%;"></div>');
  const login = $('<div class="about"></div>');
  section.appendTo(div);
  if (offlineMode) {
    button = $(
      '<div class="button_simple centered login_link_about">Login</div>'
    );
  } else {
    button = $(
      '<div class="button_simple centered login_link_about">Logout</div>'
    );
  }
  button.appendTo(login);
  login.appendTo(section);

  div.appendTo(wrap_r);
  $("#ux_0").append(wrap_l);
  $("#ux_0").append(wrap_r);

  $(".ss" + openSection).show();
  $(".sn" + openSection).addClass("nav_selected");

  $(".resetOverlayPos").click(function() {
    ipc_send("reset_overlay_pos", true);
  });

  $(".top_logo_about").click(function() {
    shell.openExternal("https://mtgatool.com");
  });

  $(".twitter_link").click(function() {
    shell.openExternal("https://twitter.com/MEtchegaray7");
  });

  $(".discord_link").click(function() {
    shell.openExternal("https://discord.gg/K9bPkJy");
  });

  $(".git_link").click(function() {
    shell.openExternal("https://github.com/Manuel-777/MTG-Arena-Tool");
  });

  $(".release_notes_link").click(function() {
    shell.openExternal("https://mtgatool.com/release-notes/");
  });

  $(".donate_link").click(function() {
    shell.openExternal("https://www.paypal.me/ManuelEtchegaray/10");
  });

  $(".login_link_about").click(function() {
    const clearAppSettings = {
      remember_me: false,
      auto_login: false,
      launch_to_tray: false
    };
    ipc_send("save_app_settings", clearAppSettings);
    remote.app.relaunch();
    remote.app.exit(0);
  });

  $(".update_link_about").click(function() {
    ipc_send("updates_check", true);
  });

  $(".settings_nav").click(function() {
    if (!$(this).hasClass("nav_selected")) {
      $(".settings_nav").each(function() {
        $(this).removeClass("nav_selected");
      });
      $(".settings_section").each(function() {
        $(this).hide();
      });

      $(this).addClass("nav_selected");

      if ($(this).hasClass("sn1")) {
        lastSettingsSection = 1;
        $(".ss1").show();
      }
      if ($(this).hasClass("sn2")) {
        lastSettingsSection = 2;
        $(".ss2").show();
      }
      if ($(this).hasClass("sn3")) {
        lastSettingsSection = 3;
        $(".ss3").show();
      }
      if ($(this).hasClass("sn4")) {
        lastSettingsSection = 4;
        $(".ss4").show();
      }
      if ($(this).hasClass("sn5")) {
        lastSettingsSection = 5;
        $(".ss5").show();
      }
      if ($(this).hasClass("sn6")) {
        lastSettingsSection = 6;
        $(".ss6").show();
      }
    }
  });

  url_input.on("keyup", function(e) {
    if (e.keyCode === 13) {
      updateUserSettings();
    }
  });

  export_input.on("keyup", function() {
    updateUserSettings();
  });

  $(".sliderA").off();

  $(".sliderA").on("click mousemove", function() {
    cardSizePos = Math.round(parseInt(this.value));
    sliderlabel.html("Cards size: " + cardSize + "px");

    $(".inventory_card_settings").css("width", "");
    let styles = $(".inventory_card_settings").attr("style");
    styles += "width: " + cardSize + "px !important;";
    $(".inventory_card_settings").attr("style", styles);

    $(".inventory_card_settings_img").css("width", "");
    styles = $(".inventory_card_settings_img").attr("style");
    styles += "width: " + cardSize + "px !important;";
    $(".inventory_card_settings_img").attr("style", styles);
  });

  $(".sliderA").on("click mouseup", function() {
    cardSizePos = Math.round(parseInt(this.value));
    updateUserSettings();
  });

  $(".sliderB").off();

  $(".sliderB").on("click mousemove", function() {
    overlayAlpha = alphaFromTransparency(parseInt(this.value));
    sliderOpacityLabel.html(
      "Elements transparency: " + transparencyFromAlpha(overlayAlpha) + "%"
    );
  });

  $(".sliderB").on("click mouseup", function() {
    overlayAlpha = alphaFromTransparency(parseInt(this.value));
    updateUserSettings();
  });

  $(".sliderC").on("click mousemove", function() {
    overlayAlphaBack = alphaFromTransparency(parseInt(this.value));
    sliderOpacityBackLabel.html(
      "Background transparency: " +
        transparencyFromAlpha(overlayAlphaBack) +
        "%"
    );
  });

  $(".sliderC").on("click mouseup", function() {
    overlayAlphaBack = alphaFromTransparency(parseInt(this.value));
    updateUserSettings();
  });

  $(".sliderD").off();

  $(".sliderD").on("click mousemove", function() {
    overlayScale = parseInt(this.value);
    sliderScaleLabel.html("Scale: " + overlayScale + "%");
  });

  $(".sliderD").on("click mouseup", function() {
    overlayScale = parseInt(this.value);
    updateUserSettings();
  });

  $(".sliderSoundVolume").off();

  $(".sliderSoundVolume").on("click mouseup", function() {
    sliderSoundVolumeLabel.html(
      `Volume: ${Math.round(settings.sound_priority_volume * 100)}%`
    );
    let { Howl, Howler } = require("howler");
    let sound = new Howl({ src: ["../sounds/blip.mp3"] });
    updateUserSettings();
    Howler.volume(settings.sound_priority_volume);
    sound.play();
  });
}

//
function updateAppSettings() {
  const auto_login = document.getElementById("settings_autologin").checked;
  const launch_to_tray = document.getElementById("settings_launchtotray")
    .checked;
  const beta_channel = document.getElementById("settings_betachannel").checked;
  const rSettings = {
    auto_login,
    launch_to_tray,
    beta_channel
  };
  ipc_send("save_app_settings", rSettings);
}

//
function alphaFromTransparency(transparency) {
  return 1 - transparency / 100;
}

//
function transparencyFromAlpha(alpha) {
  return Math.round((1 - alpha) * 100);
}

// only purpose is to strip paramaters for use with add_checkbox
function updateUserSettings() {
  updateUserSettingsBlend();
}

//
function updateUserSettingsBlend(_settings = {}) {
  const startup = document.getElementById("settings_startup").checked;
  const readonlogin = document.getElementById("settings_readlogonlogin")
    .checked;
  const showOverlay = document.getElementById("settings_showoverlay").checked;
  const showOverlayAlways = document.getElementById(
    "settings_showoverlayalways"
  ).checked;
  const soundPriority = document.getElementById("settings_soundpriority")
    .checked;

  const soundPriorityVolume = document.getElementById(
    "settings_soundpriorityvolume"
  ).value;

  const backColor = $(".color_picker")
    .spectrum("get")
    .toRgbString();
  const backUrl = document.getElementById("query_image").value;
  if (backUrl === "") change_background("default");
  else change_background(backUrl);

  const overlayOnTop = document.getElementById("settings_overlay_ontop")
    .checked;
  const closeToTray = document.getElementById("settings_closetotray").checked;
  const sendData = document.getElementById("settings_senddata").checked;
  const anonExplore = document.getElementById("settings_anon_explore").checked;

  const closeOnMatch = document.getElementById("settings_closeonmatch").checked;

  const overlayTop = document.getElementById("settings_overlay_top").checked;
  const overlayTitle = document.getElementById("settings_overlay_title")
    .checked;
  const overlayDeck = document.getElementById("settings_overlay_deck").checked;
  const overlayClock = document.getElementById("settings_overlay_clock")
    .checked;
  const overlaySideboard = document.getElementById("settings_overlay_sideboard")
    .checked;
  const overlayLands = document.getElementById("settings_overlay_lands")
    .checked;

  const exportFormat = document.getElementById("settings_export_format").value;
  settings = {
    sound_priority: soundPriority,
    sound_priority_volume: soundPriorityVolume,
    show_overlay: showOverlay,
    show_overlay_always: showOverlayAlways,
    startup: startup,
    close_to_tray: closeToTray,
    send_data: sendData,
    close_on_match: closeOnMatch,
    cards_size: cardSizePos,
    cards_quality: cardQuality,
    card_tile_style: cardStyle,
    overlay_alpha: overlayAlpha,
    overlay_alpha_back: overlayAlphaBack,
    overlay_scale: overlayScale,
    overlay_top: overlayTop,
    overlay_title: overlayTitle,
    overlay_deck: overlayDeck,
    overlay_clock: overlayClock,
    overlay_sideboard: overlaySideboard,
    overlay_ontop: overlayOnTop,
    overlay_lands: overlayLands,
    anon_explore: anonExplore,
    back_color: backColor,
    back_url: backUrl,
    export_format: exportFormat,
    skip_firstpass: !readonlogin,
    ..._settings
  };
  ipc_send("save_user_settings", settings);
}

//
ipc.on("set_settings", function(event, arg) {
  settings = arg;
  cardSizePos = settings.cards_size;
  overlayAlpha = settings.overlay_alpha;
  overlayAlphaBack = settings.overlay_alpha_back;
  overlayScale = settings.overlay_scale;
  if (overlayScale === undefined) {
    overlayScale = 100;
  }
  if (settings.back_color === undefined) {
    settings.back_color = "rgba(0,0,0,0.3)";
  }
  if (settings.back_url === undefined) {
    settings.back_url = "";
  }
});

//
ipc.on("set_update_state", function(event, arg) {
  updateState = arg;
});

//
function eraseData() {
  if (
    confirm(
      "This will erase all of your decks and events shared online, are you sure?"
    )
  ) {
    ipc_send("delete_data", true);
  } else {
    return;
  }
}

module.exports = { openSettingsTab };
