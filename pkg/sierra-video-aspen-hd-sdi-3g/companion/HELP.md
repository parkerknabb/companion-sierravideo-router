## Sierra Video Aspen HD/SDI 3G

This module controls Sierra Video Aspen HD/SDI 3G routing switchers over TCP using the Host Protocol on port `10001`.

### Connection Settings

- `Target IP Address`: The IP address of the switcher.
- `Target Port`: The TCP port. Default is `10001`.

### Actions

- Route an input to an output on all levels
- Route an input to an output on a specific level
- Route multiple levels at once with a `V` command
- Trigger a salvo
- Request a status refresh

### Feedbacks

- Match an output against a source on one level or across all levels

### Variables

- `router_model`
- `router_version`
- `router_outputs`
- `router_inputs`
- `router_levels`
- `router_capabilities`
- `router_update_mode`
- `router_level_name_1`, `router_level_name_2`, and so on
- `output_1_level_1`, `output_1_level_2`, and so on
