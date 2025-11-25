/**
 * @file HTML+Django template grammar for tree-sitter
 * @author Based on tree-sitter-html by Max Brunsfeld and tree-sitter-django
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'htmldjango',

  word: $ => $.identifier,

  extras: $ => [
    $.comment,
    /\s+/,
  ],

  externals: $ => [
    $._html_start_tag_name,
    $._void_start_tag_name,
    $._foreign_start_tag_name,
    $._script_start_tag_name,
    $._style_start_tag_name,
    $._title_start_tag_name,
    $._textarea_start_tag_name,
    $._plaintext_start_tag_name,
    $._end_tag_name,
    $.erroneous_end_tag_name,
    '/>',
    $._implicit_end_tag,
    $.raw_text,
    $.rcdata_text,
    $.plaintext_text,
    $.comment,
    // Django externals
    $._django_comment_content,
  ],

  conflicts: $ => [
    // Django conflicts for unbalanced HTML in conditionals
    [$.django_for_block],
    [$.django_if_block],
    [$.django_elif_branch],
    [$.django_else_branch],
    [$.django_empty_branch],
    // Generic block vs tag
    [$.django_generic_block, $.django_generic_tag],
    // Cycle tag: named reference vs filter expression
    [$.django_cycle_tag, $.lookup],
    // Cycle value vs literal
    [$.cycle_value, $.literal],
    // Unpaired tags vs normal elements
    [$.normal_element, $._start_tag_only],
  ],

  rules: {
    document: $ => repeat($._node),

    // ==========================================================================
    // Node types
    // ==========================================================================

    _node: $ => choice(
      $._html_node,
      $._django_node,
    ),

    _html_node: $ => choice(
      $.doctype,
      $.text,
      $.element,
    ),

    _django_node: $ => choice(
      $.django_interpolation,
      $.django_comment,
      $.django_block_comment,
      $.django_statement,
    ),

    // ==========================================================================
    // HTML: Doctype
    // ==========================================================================

    doctype: $ => seq(
      '<!',
      alias($._doctype, 'doctype'),
      /[^>]+/,
      '>',
    ),

    _doctype: _ => /[Dd][Oo][Cc][Tt][Yy][Pp][Ee]/,

    // ==========================================================================
    // HTML: Elements
    // ==========================================================================

    element: $ => choice(
      $.void_element,
      $.normal_element,
      $.script_element,
      $.style_element,
      $.rcdata_element,
      $.plaintext_element,
      $.foreign_element,
      $.erroneous_end_tag,
    ),

    void_element: $ => seq(
      '<',
      alias($._void_start_tag_name, $.tag_name),
      repeat($._attribute_node),
      choice('>', '/>'),
    ),

    normal_element: $ => seq(
      '<',
      alias($._html_start_tag_name, $.tag_name),
      repeat($._attribute_node),
      choice('>', '/>'),
      repeat($._node),
      choice($.end_tag, $._implicit_end_tag),
    ),

    // For unbalanced HTML tags inside Django conditionals
    _start_tag_only: $ => seq(
      '<',
      alias($._html_start_tag_name, $.tag_name),
      repeat($._attribute_node),
      choice('>', '/>'),
    ),

    script_element: $ => seq(
      alias($.script_start_tag, $.start_tag),
      optional(alias($._raw_text_with_django, $.raw_text)),
      $.end_tag,
    ),

    _raw_text_with_django: $ => repeat1(choice(
      $.raw_text,
      $.django_interpolation,
      $.django_comment,
      $.django_statement,
    )),

    style_element: $ => seq(
      alias($.style_start_tag, $.start_tag),
      optional(alias($._raw_text_with_django, $.raw_text)),
      $.end_tag,
    ),

    rcdata_element: $ => choice(
      seq(
        alias($.title_start_tag, $.start_tag),
        optional($._rcdata_with_django),
        $.end_tag,
      ),
      seq(
        alias($.textarea_start_tag, $.start_tag),
        optional($._rcdata_with_django),
        $.end_tag,
      ),
    ),

    _rcdata_with_django: $ => repeat1(choice(
      $.rcdata_text,
      $.django_interpolation,
      $.django_comment,
      $.django_statement,
    )),

    plaintext_element: $ => seq(
      alias($.plaintext_start_tag, $.start_tag),
      optional($.plaintext_text),
    ),

    foreign_element: $ => seq(
      '<',
      alias($._foreign_start_tag_name, $.tag_name),
      repeat($._attribute_node),
      choice(
        seq('>', repeat($._node), choice($.end_tag, $._implicit_end_tag)),
        '/>',
      ),
    ),

    // ==========================================================================
    // HTML: Start/End Tags
    // ==========================================================================

    start_tag: $ => seq(
      '<',
      alias(
        choice(
          $._html_start_tag_name,
          $._void_start_tag_name,
          $._foreign_start_tag_name,
          $._script_start_tag_name,
          $._style_start_tag_name,
          $._title_start_tag_name,
          $._textarea_start_tag_name,
          $._plaintext_start_tag_name,
        ),
        $.tag_name,
      ),
      repeat($._attribute_node),
      choice('>', '/>'),
    ),

    script_start_tag: $ => seq(
      '<',
      alias($._script_start_tag_name, $.tag_name),
      repeat($._attribute_node),
      choice('>', '/>'),
    ),

    style_start_tag: $ => seq(
      '<',
      alias($._style_start_tag_name, $.tag_name),
      repeat($._attribute_node),
      choice('>', '/>'),
    ),

    title_start_tag: $ => seq(
      '<',
      alias($._title_start_tag_name, $.tag_name),
      repeat($._attribute_node),
      choice('>', '/>'),
    ),

    textarea_start_tag: $ => seq(
      '<',
      alias($._textarea_start_tag_name, $.tag_name),
      repeat($._attribute_node),
      choice('>', '/>'),
    ),

    plaintext_start_tag: $ => seq(
      '<',
      alias($._plaintext_start_tag_name, $.tag_name),
      repeat($._attribute_node),
      choice('>', '/>'),
    ),

    end_tag: $ => seq(
      '</',
      alias($._end_tag_name, $.tag_name),
      '>',
    ),

    erroneous_end_tag: $ => seq(
      '</',
      $.erroneous_end_tag_name,
      '>',
    ),

    // ==========================================================================
    // HTML: Attributes
    // ==========================================================================

    _attribute_node: $ => choice(
      $.attribute,
      $.django_interpolation,
      $.django_statement,
    ),

    attribute: $ => seq(
      $.attribute_name,
      optional(seq(
        '=',
        choice(
          $.attribute_value,
          $.quoted_attribute_value,
        ),
      )),
    ),

    attribute_name: _ => /[^<>"'/=\s\{%]+/,

    attribute_value: $ => prec.left(repeat1(choice(
      $.entity,
      /[^<>"'=\s\{%]+/,
      $.django_interpolation,
    ))),

    quoted_attribute_value: $ => choice(
      seq(
        "'",
        repeat(choice(
          $.entity,
          alias(/[^'&\{%]+/, $.attribute_value),
          $.django_interpolation,
          $.django_statement,
        )),
        "'",
      ),
      seq(
        '"',
        repeat(choice(
          $.entity,
          alias(/[^"&\{%]+/, $.attribute_value),
          $.django_interpolation,
          $.django_statement,
        )),
        '"',
      ),
    ),

    // ==========================================================================
    // HTML: Text and Entities
    // ==========================================================================

    entity: _ => /&(#x[0-9A-Fa-f]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/,

    text: $ => prec.right(repeat1(choice(
      $.entity,
      // Single brace that's not start of Django (lookahead simulation)
      token(prec(-1, /\{/)),
      // Regular text excluding HTML special chars and braces
      token(/[^<>&\s\{][^<>&\{]*/),
    ))),

    // ==========================================================================
    // Django: Interpolation ({{ expression }})
    // ==========================================================================

    django_interpolation: $ => seq(
      '{{',
      optional($._django_inner_ws),
      optional($.filter_expression),
      optional($._django_inner_ws),
      '}}',
    ),

    // ==========================================================================
    // Django: Comments
    // ==========================================================================

    django_comment: _ => token(seq(
      '{#',
      /[^#]*#*([^#}][^#]*#*)*/,
      '#}',
    )),

    django_block_comment: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'comment',
      optional(seq($._django_inner_ws, alias(/[^%]+/, $.comment_text))),
      '%}',
      $._django_comment_content,
    ),

    // ==========================================================================
    // Django: Statements
    // ==========================================================================

    django_statement: $ => choice(
      $.django_if_block,
      $.django_for_block,
      $.django_with_block,
      $.django_block_block,
      $.django_extends_tag,
      $.django_include_tag,
      $.django_load_tag,
      $.django_url_tag,
      $.django_csrf_token_tag,
      $.django_autoescape_block,
      $.django_filter_block,
      $.django_spaceless_block,
      $.django_verbatim_block,
      $.django_cycle_tag,
      $.django_firstof_tag,
      $.django_now_tag,
      $.django_regroup_tag,
      $.django_ifchanged_block,
      $.django_widthratio_tag,
      $.django_templatetag_tag,
      $.django_debug_tag,
      $.django_generic_block,
      $.django_generic_tag,
    ),

    // ==========================================================================
    // Django: If Block
    // ==========================================================================

    django_if_block: $ => seq(
      $.django_if_open,
      repeat(choice($._node, alias($._start_tag_only, $.unpaired_start_tag), alias($.end_tag, $.unpaired_end_tag))),
      repeat($.django_elif_branch),
      optional($.django_else_branch),
      $.django_endif,
    ),

    django_if_open: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'if',
      $._django_inner_ws,
      $.test_expression,
      optional($._django_inner_ws),
      '%}',
    ),

    django_elif_branch: $ => seq(
      $.django_elif,
      repeat(choice($._node, alias($._start_tag_only, $.unpaired_start_tag), alias($.end_tag, $.unpaired_end_tag))),
    ),

    django_elif: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'elif',
      $._django_inner_ws,
      $.test_expression,
      optional($._django_inner_ws),
      '%}',
    ),

    django_else_branch: $ => seq(
      $.django_else,
      repeat(choice($._node, alias($._start_tag_only, $.unpaired_start_tag), alias($.end_tag, $.unpaired_end_tag))),
    ),

    django_else: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'else',
      '%}',
    ),

    django_endif: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'endif',
      '%}',
    ),

    // ==========================================================================
    // Django: For Block
    // ==========================================================================

    django_for_block: $ => seq(
      $.django_for_open,
      repeat(choice($._node, alias($._start_tag_only, $.unpaired_start_tag), alias($.end_tag, $.unpaired_end_tag))),
      optional($.django_empty_branch),
      $.django_endfor,
    ),

    django_for_open: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'for',
      $._django_inner_ws,
      $.loop_variables,
      $._django_inner_ws,
      'in',
      $._django_inner_ws,
      $.filter_expression,
      optional(seq($._django_inner_ws, 'reversed')),
      optional($._django_inner_ws),
      '%}',
    ),

    django_empty_branch: $ => seq(
      $.django_empty,
      repeat(choice($._node, alias($._start_tag_only, $.unpaired_start_tag), alias($.end_tag, $.unpaired_end_tag))),
    ),

    django_empty: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'empty',
      '%}',
    ),

    django_endfor: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'endfor',
      '%}',
    ),

    loop_variables: $ => prec.left(seq(
      $.identifier,
      repeat(seq(optional($._django_inner_ws), ',', optional($._django_inner_ws), $.identifier)),
    )),

    // ==========================================================================
    // Django: With Block
    // ==========================================================================

    django_with_block: $ => seq(
      $.django_with_open,
      repeat($._node),
      $.django_endwith,
    ),

    django_with_open: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'with',
      $._django_inner_ws,
      choice(
        $.with_assignments,
        $.with_legacy,
      ),
      '%}',
    ),

    with_assignments: $ => repeat1(seq($.assignment, optional($._django_inner_ws))),

    with_legacy: $ => seq(
      $.filter_expression,
      optional($._django_inner_ws),
      'as',
      optional($._django_inner_ws),
      $.identifier,
      repeat(seq(
        optional($._django_inner_ws),
        'and',
        optional($._django_inner_ws),
        $.filter_expression,
        optional($._django_inner_ws),
        'as',
        optional($._django_inner_ws),
        $.identifier,
      )),
    ),

    django_endwith: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'endwith',
      '%}',
    ),

    // ==========================================================================
    // Django: Block Block (template inheritance)
    // ==========================================================================

    django_block_block: $ => seq(
      $.django_block_open,
      repeat($._node),
      $.django_endblock,
    ),

    django_block_open: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'block',
      $._django_inner_ws,
      $.identifier,
      '%}',
    ),

    django_endblock: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'endblock',
      optional(seq($._django_inner_ws, $.identifier)),
      '%}',
    ),

    // ==========================================================================
    // Django: Extends, Include, Load
    // ==========================================================================

    django_extends_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'extends',
      $._django_inner_ws,
      $.filter_expression,
      '%}',
    ),

    django_include_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'include',
      $._django_inner_ws,
      $.filter_expression,
      optional(choice(
        seq(
          $._django_inner_ws,
          'with',
          $._django_inner_ws,
          repeat1(seq($.assignment, optional($._django_inner_ws))),
          optional(seq(optional($._django_inner_ws), 'only')),
        ),
        seq($._django_inner_ws, 'only'),
      )),
      '%}',
    ),

    django_load_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'load',
      $._django_inner_ws,
      choice(
        seq(
          repeat1(seq($.library_name, optional($._django_inner_ws))),
          'from',
          $._django_inner_ws,
          $.library_name,
        ),
        repeat1(seq($.library_name, optional($._django_inner_ws))),
      ),
      '%}',
    ),

    library_name: _ => /[A-Za-z_][\w.]*/,

    // ==========================================================================
    // Django: URL
    // ==========================================================================

    django_url_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'url',
      $._django_inner_ws,
      $.filter_expression,
      repeat(seq(
        $._django_inner_ws,
        choice($.named_argument, $.filter_expression),
      )),
      optional(seq($._django_inner_ws, 'as', $._django_inner_ws, $.identifier)),
      '%}',
    ),

    named_argument: $ => prec.dynamic(1, seq(
      $.identifier,
      '=',
      $.filter_expression,
    )),

    // ==========================================================================
    // Django: CSRF Token
    // ==========================================================================

    django_csrf_token_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'csrf_token',
      '%}',
    ),

    // ==========================================================================
    // Django: Autoescape Block
    // ==========================================================================

    django_autoescape_block: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'autoescape',
      $._django_inner_ws,
      choice('on', 'off'),
      '%}',
      repeat($._node),
      '{%',
      optional($._django_inner_ws),
      'endautoescape',
      '%}',
    ),

    // ==========================================================================
    // Django: Filter Block
    // ==========================================================================

    django_filter_block: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'filter',
      $._django_inner_ws,
      $.filter_chain,
      '%}',
      repeat($._node),
      '{%',
      optional($._django_inner_ws),
      'endfilter',
      '%}',
    ),

    filter_chain: $ => seq(
      $.filter_call,
      repeat(seq(optional($._django_inner_ws), '|', optional($._django_inner_ws), $.filter_call)),
    ),

    // ==========================================================================
    // Django: Spaceless Block
    // ==========================================================================

    django_spaceless_block: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'spaceless',
      '%}',
      repeat($._node),
      '{%',
      optional($._django_inner_ws),
      'endspaceless',
      '%}',
    ),

    // ==========================================================================
    // Django: Verbatim Block (HTML parsed, Django not parsed)
    // ==========================================================================

    django_verbatim_block: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'verbatim',
      optional(seq($._django_inner_ws, $.identifier)),
      '%}',
      repeat($._html_node),
      '{%',
      optional($._django_inner_ws),
      'endverbatim',
      optional(seq($._django_inner_ws, $.identifier)),
      '%}',
    ),

    // ==========================================================================
    // Django: Cycle Tag
    // ==========================================================================

    django_cycle_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'cycle',
      $._django_inner_ws,
      choice(
        $.identifier,
        seq(
          $.cycle_value,
          repeat(seq($._django_inner_ws, $.cycle_value)),
          optional(seq($._django_inner_ws, 'as', $._django_inner_ws, $.identifier, optional(seq($._django_inner_ws, 'silent')))),
        ),
      ),
      '%}',
    ),

    cycle_value: $ => choice($.string, $.filter_expression),

    // ==========================================================================
    // Django: Firstof Tag
    // ==========================================================================

    django_firstof_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'firstof',
      repeat1(seq($._django_inner_ws, $.filter_expression)),
      optional(seq($._django_inner_ws, 'as', $._django_inner_ws, $.identifier)),
      '%}',
    ),

    // ==========================================================================
    // Django: Now Tag
    // ==========================================================================

    django_now_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'now',
      $._django_inner_ws,
      $.string,
      optional(seq($._django_inner_ws, 'as', $._django_inner_ws, $.identifier)),
      '%}',
    ),

    // ==========================================================================
    // Django: Regroup Tag
    // ==========================================================================

    django_regroup_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'regroup',
      $._django_inner_ws,
      $.filter_expression,
      $._django_inner_ws,
      'by',
      $._django_inner_ws,
      $.lookup,
      $._django_inner_ws,
      'as',
      $._django_inner_ws,
      $.identifier,
      '%}',
    ),

    // ==========================================================================
    // Django: Ifchanged Block
    // ==========================================================================

    django_ifchanged_block: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'ifchanged',
      optional(repeat1(seq($._django_inner_ws, $.filter_expression))),
      '%}',
      repeat($._node),
      optional(seq(
        '{%',
        optional($._django_inner_ws),
        'else',
        '%}',
        repeat($._node),
      )),
      '{%',
      optional($._django_inner_ws),
      'endifchanged',
      '%}',
    ),

    // ==========================================================================
    // Django: Widthratio Tag
    // ==========================================================================

    django_widthratio_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'widthratio',
      $._django_inner_ws,
      $.filter_expression,
      $._django_inner_ws,
      $.filter_expression,
      $._django_inner_ws,
      $.filter_expression,
      optional(seq($._django_inner_ws, 'as', $._django_inner_ws, $.identifier)),
      '%}',
    ),

    // ==========================================================================
    // Django: Templatetag Tag
    // ==========================================================================

    django_templatetag_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'templatetag',
      $._django_inner_ws,
      choice(
        'openblock',
        'closeblock',
        'openvariable',
        'closevariable',
        'openbrace',
        'closebrace',
        'opencomment',
        'closecomment',
      ),
      '%}',
    ),

    // ==========================================================================
    // Django: Debug Tag
    // ==========================================================================

    django_debug_tag: $ => seq(
      '{%',
      optional($._django_inner_ws),
      'debug',
      '%}',
    ),

    // ==========================================================================
    // Django: Generic Block and Tag (fallback for unknown tags)
    // ==========================================================================

    django_generic_block: $ => prec.dynamic(-1, seq(
      '{%',
      optional($._django_inner_ws),
      field('name', $.generic_tag_name),
      repeat(seq($._django_inner_ws, $._tag_argument)),
      '%}',
      repeat($._node),
      '{%',
      optional($._django_inner_ws),
      field('end_name', seq('end', $.generic_tag_name)),
      '%}',
    )),

    django_generic_tag: $ => prec(-1, seq(
      '{%',
      optional($._django_inner_ws),
      $.generic_tag_name,
      repeat(seq($._django_inner_ws, $._tag_argument)),
      '%}',
    )),

    generic_tag_name: $ => $.identifier,

    _tag_argument: $ => choice(
      $.assignment,
      $.filter_expression,
    ),

    // ==========================================================================
    // Django: Expressions
    // ==========================================================================

    filter_expression: $ => prec.left(seq(
      $.primary_expression,
      repeat(seq(
        optional($._django_inner_ws),
        '|',
        optional($._django_inner_ws),
        $.filter_call,
      )),
    )),

    primary_expression: $ => choice(
      $.literal,
      $.lookup,
    ),

    literal: $ => choice(
      $.string,
      $.number,
      $.i18n_string,
    ),

    lookup: $ => seq(
      $.identifier,
      repeat(seq('.', choice($.identifier, /\d+/))),
    ),

    filter_call: $ => prec.left(seq(
      alias($.identifier, $.filter_name),
      optional(seq(
        ':',
        optional($._django_inner_ws),
        $.filter_argument,
      )),
    )),

    filter_argument: $ => choice(
      $.literal,
      $.lookup,
    ),

    assignment: $ => seq(
      $.identifier,
      '=',
      $.filter_expression,
    ),

    // ==========================================================================
    // Django: Test Expressions (for {% if %})
    // ==========================================================================

    test_expression: $ => $.or_expression,

    or_expression: $ => prec.left(1, seq(
      $.and_expression,
      repeat(seq($._or_keyword, $.and_expression)),
    )),

    _or_keyword: _ => token(seq(/[ \t\r\n]+/, 'or', /[ \t\r\n]+/)),

    and_expression: $ => prec.left(2, seq(
      $.not_expression,
      repeat(seq($._and_keyword, $.not_expression)),
    )),

    _and_keyword: _ => token(seq(/[ \t\r\n]+/, 'and', /[ \t\r\n]+/)),

    not_expression: $ => choice(
      prec(3, seq('not', $._django_inner_ws, $.not_expression)),
      $.comparison_expression,
    ),

    comparison_expression: $ => prec.left(4, seq(
      $.filter_expression,
      repeat(seq(
        $._django_inner_ws,
        $.comparison_operator,
        $._django_inner_ws,
        $.filter_expression,
      )),
    )),

    comparison_operator: _ => choice(
      token(prec(5, seq('not', /[ \t\r\n]+/, 'in'))),
      token(seq('is', /[ \t\r\n]+/, 'not')),
      'in',
      'is',
      '==',
      '!=',
      '>=',
      '>',
      '<=',
      '<',
    ),

    // ==========================================================================
    // Django: Tokens
    // ==========================================================================

    identifier: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    number: _ => token(prec(1, seq(
      optional(choice('+', '-')),
      choice(
        seq(/\d+\.\d+/, optional(seq(/[eE]/, optional(choice('+', '-')), /\d+/))),
        seq(/\d+\./, /[eE]/, optional(choice('+', '-')), /\d+/),
        seq(/\.\d+/, optional(seq(/[eE]/, optional(choice('+', '-')), /\d+/))),
        seq(/\d+/, optional(seq(/[eE]/, optional(choice('+', '-')), /\d+/))),
      ),
    ))),

    string: _ => choice(
      seq("'", repeat(choice(/[^'\\]/, /\\./)), "'"),
      seq('"', repeat(choice(/[^"\\]/, /\\./)), '"'),
    ),

    i18n_string: _ => token(seq(
      '_(',
      choice(
        seq("'", repeat(choice(/[^'\\]/, /\\./)), "'"),
        seq('"', repeat(choice(/[^"\\]/, /\\./)), '"'),
      ),
      ')',
    )),

    // ==========================================================================
    // Django: Whitespace handling
    // ==========================================================================

    _django_inner_ws: _ => /[ \t\r\n]+/,
  },
});
